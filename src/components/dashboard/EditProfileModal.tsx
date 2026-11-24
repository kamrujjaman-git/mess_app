"use client";

import Image from "next/image";
import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent,
} from "react";
import { motion, useReducedMotion } from "framer-motion";
import { ImagePlus, LoaderCircle, Pencil, UserRound, X } from "lucide-react";
import type { User } from "firebase/auth";
import { useToast } from "@/components/ui/ToastProvider";
import { AnimatedFormError } from "@/components/ui/AnimatedFormError";
import { createIdempotencyKey } from "@/lib/idempotency";
import { isProfileUpdateFailure, isProfileUpdateSuccess } from "@/lib/profile";

const MAX_AVATAR_SIZE = 2 * 1024 * 1024;
const MAX_INLINE_AVATAR_SIZE = 80 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const CROP_VIEW_SIZE = 256;
const CROP_OUTPUT_SIZE = 256;

interface ImageDimensions {
  width: number;
  height: number;
}

interface CropPosition {
  x: number;
  y: number;
}

interface EditProfileModalProps {
  user: User;
  initialName: string;
  initialPhotoURL: string | null;
  onClose: () => void;
  onSaved: (name: string, photoURL: string | null) => void;
}

function getCoverScale(dimensions: ImageDimensions, zoom: number) {
  return Math.max(
    CROP_VIEW_SIZE / dimensions.width,
    CROP_VIEW_SIZE / dimensions.height
  ) * zoom;
}

function clampCropPosition(
  position: CropPosition,
  dimensions: ImageDimensions,
  zoom: number
): CropPosition {
  const scale = getCoverScale(dimensions, zoom);
  const maxX = Math.max(0, (dimensions.width * scale - CROP_VIEW_SIZE) / 2);
  const maxY = Math.max(0, (dimensions.height * scale - CROP_VIEW_SIZE) / 2);
  return {
    x: Math.max(-maxX, Math.min(maxX, position.x)),
    y: Math.max(-maxY, Math.min(maxY, position.y)),
  };
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => blob
        ? resolve(blob)
        : reject(new Error("Could not prepare the cropped profile picture.")),
      type,
      quality
    );
  });
}

async function createCroppedAvatar(
  image: HTMLImageElement,
  zoom: number,
  position: CropPosition
): Promise<File> {
  const dimensions = { width: image.naturalWidth, height: image.naturalHeight };
  if (!dimensions.width || !dimensions.height) {
    throw new Error("Wait for the image preview to load before saving.");
  }

  const canvas = document.createElement("canvas");
  canvas.width = CROP_OUTPUT_SIZE;
  canvas.height = CROP_OUTPUT_SIZE;
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Could not prepare the cropped profile picture.");
  }

  context.fillStyle = "#fff";
  context.fillRect(0, 0, CROP_OUTPUT_SIZE, CROP_OUTPUT_SIZE);
  context.imageSmoothingQuality = "high";
  const scale = getCoverScale(dimensions, zoom);
  const outputScale = CROP_OUTPUT_SIZE / CROP_VIEW_SIZE;
  const width = dimensions.width * scale;
  const height = dimensions.height * scale;
  const left = (CROP_VIEW_SIZE - width) / 2 + position.x;
  const top = (CROP_VIEW_SIZE - height) / 2 + position.y;
  context.drawImage(
    image,
    left * outputScale,
    top * outputScale,
    width * outputScale,
    height * outputScale
  );

  let blob: Blob | null = null;
  for (const type of ["image/webp", "image/jpeg"]) {
    for (const quality of [0.82, 0.74, 0.66, 0.58]) {
      const candidate = await canvasToBlob(canvas, type, quality);
      if (candidate.type === type && candidate.size <= MAX_INLINE_AVATAR_SIZE) {
        blob = candidate;
        break;
      }
    }
    if (blob) break;
  }
  if (!blob) {
    throw new Error("Could not compress this picture below 80KB. Choose a simpler image and try again.");
  }

  const extension = blob.type === "image/jpeg"
    ? "jpg"
    : blob.type === "image/webp"
      ? "webp"
      : null;
  if (!extension) {
    throw new Error("Choose a JPG, PNG, or WEBP image.");
  }

  return new File([blob], `profile-avatar.${extension}`, {
    type: blob.type,
    lastModified: Date.now(),
  });
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
  const [imageDimensions, setImageDimensions] = useState<ImageDimensions | null>(null);
  const [cropPosition, setCropPosition] = useState<CropPosition>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [errorMessage, setErrorMessage] = useState("");
  const [errorAttempt, setErrorAttempt] = useState(0);
  const [saving, setSaving] = useState(false);
  const cropImageRef = useRef<HTMLImageElement | null>(null);
  const submissionInFlightRef = useRef(false);
  const cropDragRef = useRef<{
    pointerId: number;
    clientX: number;
    clientY: number;
    position: CropPosition;
  } | null>(null);

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

  function showError(message: string) {
    setErrorMessage(message);
    setErrorAttempt((attempt) => attempt + 1);
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    if (!file) return;
    event.currentTarget.value = "";

    if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
      setSelectedFile(null);
      setPreviewURL(null);
      setImageDimensions(null);
      setCropPosition({ x: 0, y: 0 });
      setZoom(1);
      showError("Choose a JPG, PNG, or WEBP image.");
      return;
    }
    if (file.size > MAX_AVATAR_SIZE) {
      setSelectedFile(null);
      setPreviewURL(null);
      setImageDimensions(null);
      setCropPosition({ x: 0, y: 0 });
      setZoom(1);
      showError("The profile picture must be 2MB or smaller.");
      return;
    }

    setSelectedFile(file);
    setPreviewURL(URL.createObjectURL(file));
    setImageDimensions(null);
    setCropPosition({ x: 0, y: 0 });
    setZoom(1);
    setPreviewFailed(false);
    setErrorMessage("");
  }

  function handleCropPointerDown(event: PointerEvent<HTMLDivElement>) {
    if (!imageDimensions || saving) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    cropDragRef.current = {
      pointerId: event.pointerId,
      clientX: event.clientX,
      clientY: event.clientY,
      position: cropPosition,
    };
  }

  function handleCropPointerMove(event: PointerEvent<HTMLDivElement>) {
    const drag = cropDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId || !imageDimensions) return;
    setCropPosition(clampCropPosition({
      x: drag.position.x + event.clientX - drag.clientX,
      y: drag.position.y + event.clientY - drag.clientY,
    }, imageDimensions, zoom));
  }

  function handleCropPointerEnd(event: PointerEvent<HTMLDivElement>) {
    if (cropDragRef.current?.pointerId === event.pointerId) {
      cropDragRef.current = null;
    }
  }

  function handleCropKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (!imageDimensions) return;
    const distance = event.shiftKey ? 16 : 4;
    const directions: Record<string, CropPosition> = {
      ArrowLeft: { x: -distance, y: 0 },
      ArrowRight: { x: distance, y: 0 },
      ArrowUp: { x: 0, y: -distance },
      ArrowDown: { x: 0, y: distance },
    };
    const direction = directions[event.key];
    if (!direction) return;
    event.preventDefault();
    setCropPosition((position) => clampCropPosition({
      x: position.x + direction.x,
      y: position.y + direction.y,
    }, imageDimensions, zoom));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submissionInFlightRef.current) return;
    const trimmedName = name.trim();
    if (!trimmedName) {
      showError("Enter a name before saving.");
      return;
    }
    if (trimmedName.length > 80) {
      showError("Names must be 80 characters or fewer.");
      return;
    }

    submissionInFlightRef.current = true;
    setSaving(true);
    setErrorMessage("");
    try {
      const formData = new FormData();
      formData.set("name", trimmedName);
      if (selectedFile) {
        const cropImage = cropImageRef.current;
        if (!cropImage) {
          throw new Error("Wait for the image preview to load before saving.");
        }
        formData.set(
          "avatar",
          await createCroppedAvatar(cropImage, zoom, cropPosition)
        );
      }

      const response = await fetch("/api/profile", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${await user.getIdToken()}`,
          "X-Idempotency-Key": createIdempotencyKey(),
        },
        body: formData,
      });

      const responseText = await response.text();
      let result: unknown;
      try {
        result = JSON.parse(responseText);
      } catch {
        throw new Error(response.ok
          ? "The profile service returned an invalid response. Try again."
          : `Could not update your profile (HTTP ${response.status}). Try again.`);
      }

      const serverFailure = isProfileUpdateFailure(result) ? result : null;
      if (!response.ok || serverFailure) {
        if (serverFailure?.step) {
          console.error(
            `[EditProfileModal] Profile API failed at step=${serverFailure.step} (HTTP ${response.status}).`
          );
        }
        throw new Error(
          serverFailure?.error ||
            `Could not update your profile (HTTP ${response.status}). Try again.`
        );
      }
      if (!isProfileUpdateSuccess(result)) {
        throw new Error("The profile service returned an incomplete response. Try again.");
      }

      onSaved(result.name, result.photoURL);
      success("Profile updated");
      onClose();
    } catch (error) {
      console.error("Profile update failed:", error);
      showError(
        error instanceof Error ? error.message : "Could not update your profile. Try again."
      );
    } finally {
      submissionInFlightRef.current = false;
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
      className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm"
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
        className="max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto rounded-2xl border border-subtle bg-surface p-4 text-primary shadow-2xl sm:p-6"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="edit-profile-title" className="text-balance text-lg font-semibold">Edit Profile</h2>
            <p className="mt-1 text-sm leading-relaxed text-muted">
              Update the name and picture shown in Mess App.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            aria-label="Close profile editor"
            className="tactile-press flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted transition-colors hover:bg-container disabled:opacity-50 dark:text-muted dark:hover:bg-elevated"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-5">
          <div className="flex items-center gap-4">
            <div className="relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-success-surface text-xl font-bold text-success ring-2 ring-brand/25">
              {visibleImageURL && !previewFailed ? (
                <Image
                  src={visibleImageURL}
                  alt="Profile picture preview"
                  width={64}
                  height={64}
                  unoptimized
                  onError={() => setPreviewFailed(true)}
                  style={previewURL ? {
                    transform: `translate(${cropPosition.x / 4}px, ${cropPosition.y / 4}px) scale(${zoom})`,
                    transformOrigin: "center",
                  } : undefined}
                  className="h-full w-full object-cover"
                />
              ) : (
                <span>{initial}</span>
              )}
            </div>
            <div className="min-w-0">
              <label
                htmlFor="profile-picture"
                className="tactile-press inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-xl border border-subtle px-3 text-sm font-medium text-secondary transition-colors hover:bg-elevated dark:border-subtle dark:text-secondary dark:hover:bg-elevated"
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
              <p className="mt-2 text-xs leading-5 text-muted dark:text-muted">
                Recommended: square (1:1), 256 x 256px to 512 x 512px, JPG, PNG, or WEBP.
                Maximum source file size: 2MB. Saved as a 256 x 256px JPEG or WEBP under 80KB.
              </p>
            </div>
          </div>

          {previewURL ? (
            <div className="space-y-3 rounded-xl border border-subtle bg-elevated/70 p-3">
              <div className="flex items-center justify-between gap-3 text-xs">
                <span className="font-medium text-secondary dark:text-secondary">Adjust 1:1 crop</span>
                <span className="text-muted dark:text-muted">Drag to position</span>
              </div>
              <div
                role="group"
                aria-label="Image crop area. Use arrow keys to reposition."
                tabIndex={0}
                onPointerDown={handleCropPointerDown}
                onPointerMove={handleCropPointerMove}
                onPointerUp={handleCropPointerEnd}
                onPointerCancel={handleCropPointerEnd}
                onKeyDown={handleCropKeyDown}
                className="relative mx-auto h-[256px] w-[256px] cursor-grab touch-none select-none overflow-hidden rounded-xl bg-container outline-none active:cursor-grabbing focus-visible:ring-2 focus-visible:ring-brand"
              >
                <Image
                  ref={cropImageRef}
                  src={previewURL}
                  alt=""
                  fill
                  unoptimized
                  sizes="256px"
                  draggable={false}
                  onLoad={(event) => {
                    setImageDimensions({
                      width: event.currentTarget.naturalWidth,
                      height: event.currentTarget.naturalHeight,
                    });
                    setCropPosition({ x: 0, y: 0 });
                  }}
                  onError={() => showError("Could not load this image. Choose a valid JPG, PNG, or WEBP file.")}
                  style={{
                    objectFit: "cover",
                    transform: `translate(${cropPosition.x}px, ${cropPosition.y}px) scale(${zoom})`,
                    transformOrigin: "center",
                  }}
                  className="pointer-events-none select-none"
                />
              </div>
              <label className="flex items-center justify-between gap-3 text-xs font-medium text-secondary dark:text-secondary">
                <span>Zoom</span>
                <span className="tabular-nums text-muted dark:text-muted">{zoom.toFixed(1)}×</span>
                <input
                  type="range"
                  min="1"
                  max="3"
                  step="0.05"
                  value={zoom}
                  onChange={(event) => {
                    const nextZoom = Number(event.currentTarget.value);
                    setZoom(nextZoom);
                    if (imageDimensions) {
                      setCropPosition((position) =>
                        clampCropPosition(position, imageDimensions, nextZoom)
                      );
                    }
                  }}
                  aria-label="Zoom profile picture"
                  className="w-36 accent-brand"
                />
              </label>
            </div>
          ) : null}

          <div>
            <label htmlFor="profile-name" className="mb-1.5 block text-sm font-medium">
              Name
            </label>
            <div className="relative">
              <UserRound
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
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
                className="h-11 w-full rounded-xl border border-subtle bg-surface pl-10 pr-3 text-sm text-primary outline-none transition-colors placeholder:text-muted focus:border-brand focus:ring-2 focus:ring-brand/15"
                placeholder="Your name"
              />
            </div>
          </div>

          <AnimatedFormError message={errorMessage} attempt={errorAttempt} />

          <div className="flex justify-end gap-2 border-t border-subtle pt-4 dark:border-subtle">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="tactile-press min-h-10 rounded-xl px-4 text-sm font-medium text-secondary transition-colors hover:bg-container disabled:opacity-50 dark:text-secondary dark:hover:bg-elevated"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="tactile-press inline-flex min-h-10 items-center gap-2 rounded-xl bg-brand-fill px-4 text-sm font-semibold text-brand-on-fill transition-colors hover:bg-brand-fill-hover disabled:cursor-not-allowed disabled:opacity-60"
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
