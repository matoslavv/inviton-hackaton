import { fetchJson } from "./api";

export interface User {
  id: number;
  name: string;
  email: string;
  createdAt: string;
}

export const getUsers = () => fetchJson<User[]>("/users");

export const createUser = (data: { name: string; email: string }) =>
  fetchJson<User>("/users", {
    method: "POST",
    body: JSON.stringify(data),
  });
