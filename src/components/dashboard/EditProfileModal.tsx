"use client";

import Image from "next/image";
import { useEffect, useState, type FormEvent, type ChangeEvent } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { ImagePlus, LoaderCircle, Pencil, UserRound, X } from "lucide-react";
import type { User } from "firebase/auth";
import { useToast } from "@/components/ui/ToastProvider";

const MAX_AVATAR_SIZE = 2 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

interface EditProfileModalProps {
  user: User;
  initialName: string;
  initialPhotoURL: string | null;
  onClose: () => void;
  onSaved: (name: string, photoURL: string | null) => void;
}

interface ProfileUpdateResponse {
  error?: unknown;
  name?: unknown;
  photoURL?: unknown;
}

export function EditProfileModal({
  user,
  initialName,
  initialPhotoURL,
  onClose,
  onSaved,
}: EditProfileModalProps) {
  const reduceMotion = useReducedMotion();
  const { success } = useToast();
  const [name, setName] = useState(initialName);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewURL, setPreviewURL] = useState<string | null>(null);
  const [previewFailed, setPreviewFailed] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!previewURL) return;
    return () => URL.revokeObjectURL(previewURL);
  }, [previewURL]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !saving) onClose();
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose, saving]);

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    if (!file) return;

    if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
      setSelectedFile(null);
      setPreviewURL(null);
      setErrorMessage("Choose a JPG, PNG, or WEBP image.");
      event.currentTarget.value = "";
      return;
    }
    if (file.size > MAX_AVATAR_SIZE) {
      setSelectedFile(null);
      setPreviewURL(null);
      setErrorMessage("The profile picture must be 2MB or smaller.");
      event.currentTarget.value = "";
      return;
    }

    setSelectedFile(file);
    setPreviewURL(URL.createObjectURL(file));
    setPreviewFailed(false);
    setErrorMessage("");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) {
      setErrorMessage("Enter a name before saving.");
      return;
    }
    if (trimmedName.length > 80) {
      setErrorMessage("Names must be 80 characters or fewer.");
      return;
    }

    setSaving(true);
    setErrorMessage("");
    try {
      const formData = new FormData();
      formData.set("name", trimmedName);
      if (selectedFile) formData.set("avatar", selectedFile);

      const response = await fetch("/api/profile", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${await user.getIdToken()}`,
        },
        body: formData,
      });

      let result: ProfileUpdateResponse;
      try {
        result = await response.json() as ProfileUpdateResponse;
      } catch {
        throw new Error("The profile update returned an unreadable response. Try again.");
      }

      if (!response.ok) {
        throw new Error(
          typeof result.error === "string"
            ? result.error
            : "Could not update your profile. Try again."
        );
      }
      if (typeof result.name !== "string") {
        throw new Error("The profile update response was incomplete. Try again.");
      }

      const photoURL = typeof result.photoURL === "string" ? result.photoURL : null;
      onSaved(result.name, photoURL);
      success("Profile updated");
      onClose();
    } catch (error) {
      console.error("Profile update failed:", error);
      setErrorMessage(
        error instanceof Error ? error.message : "Could not update your profile. Try again."
      );
    } finally {
      setSaving(false);
    }
  }

  const visibleImageURL = previewURL ?? initialPhotoURL;
  const initial = (name.trim().charAt(0) || "M").toUpperCase();

  return (
    <motion.div
      initial={reduceMotion ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: reduceMotion ? 0 : 0.15 }}
      className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !saving) onClose();
      }}
    >
      <motion.section
        initial={reduceMotion ? false : { opacity: 0, y: 8, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 6, scale: 0.98 }}
        transition={{ duration: reduceMotion ? 0 : 0.18 }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-profile-title"
        className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 text-slate-900 shadow-2xl dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 sm:p-6"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="edit-profile-title" className="text-lg font-semibold">Edit Profile</h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Update the name and picture shown in Mess App.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            aria-label="Close profile editor"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-slate-100 disabled:opacity-50 dark:text-slate-400 dark:hover:bg-slate-800"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-5">
          <div className="flex items-center gap-4">
            <div className="relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-emerald-100 text-xl font-bold text-emerald-700 ring-2 ring-emerald-500/25 dark:bg-emerald-950 dark:text-emerald-300">
              {visibleImageURL && !previewFailed ? (
                <Image
                  src={visibleImageURL}
                  alt="Profile picture preview"
                  width={64}
                  height={64}
                  unoptimized
                  onError={() => setPreviewFailed(true)}
                  className="h-full w-full object-cover"
                />
              ) : (
                <span>{initial}</span>
              )}
            </div>
            <div className="min-w-0">
              <label
                htmlFor="profile-picture"
                className="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-xl border border-slate-200 px-3 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                <ImagePlus className="h-4 w-4" />
                Choose picture
              </label>
              <input
                id="profile-picture"
                type="file"
                accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
                onChange={handleFileChange}
                className="sr-only"
              />
              <p className="mt-2 text-xs leading-5 text-slate-500 dark:text-slate-400">
                Recommended: square (1:1), 256 x 256px to 512 x 512px, JPG, PNG, or WEBP.
                Maximum file size: 2MB.
              </p>
            </div>
          </div>

          <div>
            <label htmlFor="profile-name" className="mb-1.5 block text-sm font-medium">
              Name
            </label>
            <div className="relative">
              <UserRound
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                aria-hidden="true"
              />
              <input
                id="profile-name"
                type="text"
                autoComplete="name"
                maxLength={80}
                value={name}
                onChange={(event) => {
                  setName(event.currentTarget.value);
                  setErrorMessage("");
                }}
                className="h-11 w-full rounded-xl border border-slate-300 bg-white pl-10 pr-3 text-sm text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/15 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                placeholder="Your name"
              />
            </div>
          </div>

          {errorMessage ? (
            <p
              role="alert"
              className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300"
            >
              {errorMessage}
            </p>
          ) : null}

          <div className="flex justify-end gap-2 border-t border-slate-200 pt-4 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="min-h-10 rounded-xl px-4 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 disabled:opacity-50 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-emerald-600 px-4 text-sm font-semibold text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? (
                <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <Pencil className="h-4 w-4" aria-hidden="true" />
              )}
              {saving ? "Saving..." : "Save changes"}
            </button>
          </div>
        </form>
      </motion.section>
    </motion.div>
  );
}
