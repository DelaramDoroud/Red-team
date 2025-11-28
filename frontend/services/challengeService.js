import { apiFetch } from "./api";

export async function getAllChallenges() {
  return apiFetch("/challenges");
}
