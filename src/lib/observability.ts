import { randomUUID } from "node:crypto";

const INTERNAL_STEP_HEADER = "x-internal-api-step";
const REQUEST_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const STEP_PATTERN = /^[a-z0-9-]{1,48}$/i;

export interface ApiRequestContext {
  requestId: string;
  route: string;
  method: string;
  setStep: (step: string) => void;
}

type ApiHandler = (context: ApiRequestContext) => Promise<Response>;

export function apiResponse(
  body: unknown,
  status = 200,
  step = status >= 400 ? "error" : "complete",
  headers?: HeadersInit
): Response {
  const response = Response.json(body, { status, headers });
  response.headers.set(INTERNAL_STEP_HEADER, step);
  return response;
}

export async function withApiObservability(
  request: Request,
  route: string,
  handler: ApiHandler
): Promise<Response> {
  const incomingRequestId = request.headers.get("x-request-id")?.trim() ?? "";
  const requestId = REQUEST_ID_PATTERN.test(incomingRequestId)
    ? incomingRequestId
    : randomUUID();
  const method = /^[A-Z]{3,8}$/.test(request.method) ? request.method : "UNKNOWN";
  const startedAt = Date.now();
  let step = "request";

  const context: ApiRequestContext = {
    requestId,
    route,
    method,
    setStep(nextStep) {
      if (STEP_PATTERN.test(nextStep)) step = nextStep;
    },
  };

  let response: Response;
  try {
    response = await handler(context);
  } catch {
    step = "unhandled";
    response = Response.json(
      { ok: false, error: "The request could not be completed.", step },
      {
        status: 500,
        headers: { [INTERNAL_STEP_HEADER]: step },
      }
    );
  }

  const responseStep = response.headers.get(INTERNAL_STEP_HEADER);
  if (responseStep && STEP_PATTERN.test(responseStep)) {
    step = responseStep;
  } else if (response.status < 400 && step === "request") {
    step = "complete";
  } else if (step === "request") {
    step = "error";
  }

  response.headers.delete(INTERNAL_STEP_HEADER);
  response.headers.set("x-request-id", requestId);
  const logRecord = JSON.stringify({
    requestId,
    route,
    method,
    step,
    status: response.status,
    durationMs: Math.max(0, Date.now() - startedAt),
  });

  if (response.status >= 500) {
    console.error(logRecord);
  } else if (response.status >= 400) {
    console.warn(logRecord);
  } else {
    console.info(logRecord);
  }

  return response;
}
