export const demoReadOnlyMessage =
  "This is a read-only demo — sign up to try this for real";

export function getMutationErrorMessage(
  message: string | undefined,
  fallback: string,
) {
  return message === "Demo accounts are read-only"
    ? demoReadOnlyMessage
    : message ?? fallback;
}
