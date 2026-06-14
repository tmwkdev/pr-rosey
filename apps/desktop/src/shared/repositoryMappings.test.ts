import {
  normalizeRepositoryNameWithOwner,
  repositoryNameWithOwnerFromRemoteUrl,
} from "@pr-rosey/desktop/shared/repositoryMappings";
import { describe, expect, it } from "vitest";

describe("repository mapping helpers", () => {
  it("normalizes owner/repo input", () => {
    expect(normalizeRepositoryNameWithOwner(" owner/repo ")).toBe("owner/repo");
    expect(normalizeRepositoryNameWithOwner("owner/repo.git")).toBe("owner/repo");
  });

  it("normalizes common github.com remote URL shapes", () => {
    expect(repositoryNameWithOwnerFromRemoteUrl("https://github.com/owner/repo.git")).toBe(
      "owner/repo",
    );
    expect(repositoryNameWithOwnerFromRemoteUrl("git@github.com:owner/repo.git")).toBe(
      "owner/repo",
    );
    expect(repositoryNameWithOwnerFromRemoteUrl("ssh://git@github.com/owner/repo.git")).toBe(
      "owner/repo",
    );
  });

  it("rejects non-GitHub and malformed remotes", () => {
    expect(repositoryNameWithOwnerFromRemoteUrl("https://gitlab.com/owner/repo.git")).toBeNull();
    expect(normalizeRepositoryNameWithOwner("not-a-repository")).toBeNull();
  });
});
