import { NextResponse } from "next/server";
import { getAdminAuth, getAdminFirestore } from "@/lib/firebase-admin";

export const runtime = "nodejs";

const MAX_TRANSACTION_WRITES = 500;

class MemberDeletionError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = "MemberDeletionError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeEmail(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function getMemberEmail(member: Record<string, unknown>): string {
  return normalizeEmail(member.email);
}

async function deleteMemberData(memberId: string, performedBy: string) {
  const firestore = getAdminFirestore();
  const membersRef = firestore.doc("settings/members");
  const activityRef = firestore.collection("activity_logs").doc();

  return firestore.runTransaction(async (transaction) => {
    const membersSnapshot = await transaction.get(membersRef);
    const settings = membersSnapshot.data();
    const rawMembers = settings?.members;
    if (!Array.isArray(rawMembers)) {
      throw new MemberDeletionError("The member directory is unavailable.", 409);
    }

    if (!rawMembers.every(isRecord)) {
      throw new MemberDeletionError("The member directory contains invalid records.", 409);
    }
    const members = rawMembers;
    const targetMember = members.find((member) => member.id === memberId);
    if (!targetMember) {
      throw new MemberDeletionError("Member not found. Refresh the dashboard and try again.", 404);
    }

    const targetEmail = getMemberEmail(targetMember);
    const configuredAdminEmail = normalizeEmail(process.env.NEXT_PUBLIC_ADMIN_EMAIL);
    if (targetEmail && targetEmail === configuredAdminEmail) {
      throw new MemberDeletionError("The configured Super Admin cannot be deleted.", 409);
    }

    const mealsSnapshot = await transaction.get(firestore.collectionGroup("dailyMeals"));
    const bazarSnapshot = await transaction.get(firestore.collectionGroup("bazar"));
    const depositsSnapshot = await transaction.get(firestore.collectionGroup("deposits"));
    const directProfileSnapshot = await transaction.get(firestore.doc(`users/${memberId}`));
    const emailProfileSnapshots = [];
    if (targetEmail) {
      emailProfileSnapshots.push(
        await transaction.get(firestore.collection("users").where("email", "==", targetEmail))
      );
      const storedEmail = String(targetMember.email ?? "").trim();
      if (storedEmail && storedEmail !== targetEmail) {
        emailProfileSnapshots.push(
          await transaction.get(firestore.collection("users").where("email", "==", storedEmail))
        );
      }
    }

    const profiles = new Map<string, FirebaseFirestore.DocumentReference>();
    if (directProfileSnapshot.exists) {
      profiles.set(directProfileSnapshot.ref.path, directProfileSnapshot.ref);
    }
    for (const snapshot of emailProfileSnapshots) {
      for (const profile of snapshot.docs) {
        profiles.set(profile.ref.path, profile.ref);
      }
    }

    const mealsToUpdate: Array<{
      ref: FirebaseFirestore.DocumentReference;
      meals: Record<string, unknown>;
    }> = [];
    const mealsToDelete: FirebaseFirestore.DocumentReference[] = [];
    for (const mealDocument of mealsSnapshot.docs) {
      const meals = mealDocument.get("meals");
      if (!isRecord(meals) || !Object.prototype.hasOwnProperty.call(meals, memberId)) {
        continue;
      }

      const remainingMeals = { ...meals };
      delete remainingMeals[memberId];
      if (Object.keys(remainingMeals).length === 0) {
        mealsToDelete.push(mealDocument.ref);
      } else {
        mealsToUpdate.push({ ref: mealDocument.ref, meals: remainingMeals });
      }
    }

    const depositsToDelete = depositsSnapshot.docs.filter((deposit) => {
      const data = deposit.data();
      return data.memberId === memberId ||
        (!data.memberId && targetMember.name === data.memberName);
    });

    const bazarUpdates: Array<{
      ref: FirebaseFirestore.DocumentReference;
      buyerIds: string[];
    }> = [];
    for (const bazarDocument of bazarSnapshot.docs) {
      const data = bazarDocument.data();
      const storedBuyerIds = Array.isArray(data.buyerIds)
        ? data.buyerIds.filter((buyerId): buyerId is string =>
          typeof buyerId === "string" && buyerId.trim().length > 0
        )
        : [];
      const buyerIds = storedBuyerIds.length > 0
        ? storedBuyerIds
        : typeof data.buyerId === "string" && data.buyerId.trim()
          ? [data.buyerId.trim()]
          : [];
      if (!buyerIds.includes(memberId)) continue;

      bazarUpdates.push({
        ref: bazarDocument.ref,
        buyerIds: buyerIds.filter((buyerId) => buyerId !== memberId),
      });
    }

    const remainingMembers = members.filter((member) => member.id !== memberId);
    const adminEmails = remainingMembers
      .filter((member) => member.isAdmin === true)
      .map(getMemberEmail)
      .filter(Boolean);

    const writeCount =
      1 +
      profiles.size +
      mealsToUpdate.length +
      mealsToDelete.length +
      depositsToDelete.length +
      bazarUpdates.length +
      1;
    if (writeCount > MAX_TRANSACTION_WRITES) {
      throw new MemberDeletionError(
        `This member has too many historical records to delete atomically (${writeCount} writes; limit ${MAX_TRANSACTION_WRITES}). No records were changed.`,
        409
      );
    }

    transaction.set(membersRef, {
      ...(settings ?? {}),
      members: remainingMembers,
      adminEmails,
    });
    for (const profileRef of profiles.values()) {
      transaction.delete(profileRef);
    }
    for (const meal of mealsToUpdate) {
      transaction.update(meal.ref, { meals: meal.meals });
    }
    for (const mealRef of mealsToDelete) {
      transaction.delete(mealRef);
    }
    for (const deposit of depositsToDelete) {
      transaction.delete(deposit.ref);
    }
    for (const bazar of bazarUpdates) {
      transaction.update(bazar.ref, {
        buyerIds: bazar.buyerIds,
        buyerId: bazar.buyerIds[0] ?? null,
      });
    }

    const mealRecordCount = mealsToUpdate.length + mealsToDelete.length;
    transaction.create(activityRef, {
      id: activityRef.id,
      action: "Member Deleted",
      details: `Deleted ${String(targetMember.name ?? "member")}; cleaned ${mealRecordCount} meal record(s), ${depositsToDelete.length} deposit(s), and ${bazarUpdates.length} bazar buyer reference(s).`,
      performedBy,
      timestamp: new Date().toISOString(),
    });

    return {
      meals: mealRecordCount,
      deposits: depositsToDelete.length,
      bazarReferences: bazarUpdates.length,
      profiles: profiles.size,
    };
  });
}

export async function POST(request: Request) {
  const authorization = request.headers.get("authorization") ?? "";
  const token = authorization.startsWith("Bearer ")
    ? authorization.slice(7).trim()
    : "";
  if (!token) {
    return NextResponse.json({ error: "A verified Super Admin session is required." }, { status: 401 });
  }

  let decodedToken;
  try {
    decodedToken = await getAdminAuth().verifyIdToken(token, true);
  } catch (error) {
    console.error("Member deletion token verification failed:", error);
    return NextResponse.json({ error: "The session is invalid or expired. Sign in again." }, { status: 401 });
  }

  const configuredAdminEmail = normalizeEmail(process.env.NEXT_PUBLIC_ADMIN_EMAIL);
  const callerEmail = normalizeEmail(decodedToken.email);
  if (
    decodedToken.email_verified !== true ||
    !configuredAdminEmail ||
    callerEmail !== configuredAdminEmail
  ) {
    return NextResponse.json({ error: "Only the configured Super Admin can delete members." }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "A valid JSON request body is required." }, { status: 400 });
  }

  const memberId = isRecord(body) && typeof body.memberId === "string"
    ? body.memberId.trim()
    : "";
  if (!memberId || memberId.length > 128 || memberId.includes("/")) {
    return NextResponse.json({ error: "A valid member ID is required." }, { status: 400 });
  }

  try {
    const cleanup = await deleteMemberData(memberId, decodedToken.email ?? callerEmail);
    return NextResponse.json({ ok: true, cleanup });
  } catch (error) {
    if (error instanceof MemberDeletionError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Member deletion transaction failed:", error);
    return NextResponse.json(
      { error: "Member deletion could not be completed. Refresh the dashboard before retrying." },
      { status: 500 }
    );
  }
}
