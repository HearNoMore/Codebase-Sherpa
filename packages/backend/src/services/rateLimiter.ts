// Simple in-memory rate limiting — sufficient for the hackathon.
// In production this would move to Redis.

const MAX_CONCURRENT_JOBS = 3;
const MAX_PER_HOUR_PER_IP = 10;
const HOUR_MS = 60 * 60 * 1000;

// Track IPs → timestamps of recent submissions
const ipTimestamps = new Map<string, number[]>();

// Track how many pipeline jobs are actively running
let activeJobs = 0;

export function getActiveJobCount(): number {
  return activeJobs;
}

export function incrementActiveJobs(): void {
  activeJobs++;
}

export function decrementActiveJobs(): void {
  activeJobs = Math.max(0, activeJobs - 1);
}

export function isConcurrencyLimitReached(): boolean {
  return activeJobs >= MAX_CONCURRENT_JOBS;
}

export function isIpRateLimited(ip: string): boolean {
  const now = Date.now();
  const timestamps = (ipTimestamps.get(ip) ?? []).filter((t) => now - t < HOUR_MS);
  ipTimestamps.set(ip, timestamps);
  return timestamps.length >= MAX_PER_HOUR_PER_IP;
}

export function recordIpRequest(ip: string): void {
  const now = Date.now();
  const timestamps = (ipTimestamps.get(ip) ?? []).filter((t) => now - t < HOUR_MS);
  timestamps.push(now);
  ipTimestamps.set(ip, timestamps);
}
