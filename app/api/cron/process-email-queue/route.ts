import { GET as emailQueueGet, POST as emailQueuePost } from "@/app/api/email/process-queue/route";

export const runtime = "edge";

export const GET = emailQueueGet;
export const POST = emailQueuePost;
