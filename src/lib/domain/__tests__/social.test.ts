import { describe, expect, it } from "vitest";
import { instagramCode, normaliseSocialUrl, toVideoEmbed, youTubeId } from "../social";

describe("normaliseSocialUrl", () => {
  it("accepts a link on the platform it claims to be", () => {
    expect(normaliseSocialUrl("instagram", "https://www.instagram.com/sharma.realty")).toBe(
      "https://www.instagram.com/sharma.realty",
    );
    expect(normaliseSocialUrl("linkedin", "https://in.linkedin.com/in/rohit")).toBe(
      "https://in.linkedin.com/in/rohit",
    );
  });

  it("refuses a link on a different host", () => {
    // A field labelled Instagram that accepts anything is a way to launder an
    // arbitrary link through a trusted-looking label.
    expect(normaliseSocialUrl("instagram", "https://evil.example/phish")).toBeNull();
    expect(normaliseSocialUrl("youtube", "https://vimeo.com/12345")).toBeNull();
    // Nor a lookalike host.
    expect(normaliseSocialUrl("instagram", "https://instagram.com.evil.example/x")).toBeNull();
  });

  it("accepts what people actually paste", () => {
    expect(normaliseSocialUrl("instagram", "instagram.com/sharma.realty")).toBe(
      "https://instagram.com/sharma.realty",
    );
    expect(normaliseSocialUrl("instagram", "  https://www.instagram.com/x/  ")).toBe(
      "https://www.instagram.com/x",
    );
  });

  it("upgrades http rather than rejecting it", () => {
    expect(normaliseSocialUrl("facebook", "http://facebook.com/agency")).toBe(
      "https://facebook.com/agency",
    );
  });

  it("strips the tracking parameters these links collect", () => {
    expect(
      normaliseSocialUrl("instagram", "https://www.instagram.com/x?igsh=abc123&utm_source=y"),
    ).toBe("https://www.instagram.com/x");
  });

  it("lets a website be any host, since that is the point of the field", () => {
    expect(normaliseSocialUrl("website", "sharmarealty.in")).toBe("https://sharmarealty.in");
  });

  it("treats empty and unusable input as absent", () => {
    expect(normaliseSocialUrl("website", "")).toBeNull();
    expect(normaliseSocialUrl("website", "   ")).toBeNull();
    expect(normaliseSocialUrl("website", undefined)).toBeNull();
    expect(normaliseSocialUrl("website", "not a url at all")).toBeNull();
  });

  it("caps the length rather than storing a pasted essay", () => {
    expect(normaliseSocialUrl("website", `https://x.example/${"a".repeat(400)}`)).toBeNull();
  });
});

describe("youTubeId", () => {
  it("reads every shape YouTube hands out", () => {
    expect(youTubeId("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    expect(youTubeId("https://youtu.be/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    expect(youTubeId("https://www.youtube.com/shorts/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    expect(youTubeId("https://www.youtube.com/embed/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
  });

  it("returns null for something that is not a video", () => {
    expect(youTubeId("https://www.youtube.com/@channel")).toBeNull();
  });
});

describe("instagramCode", () => {
  it("reads reel, reels and post URLs", () => {
    expect(instagramCode("https://www.instagram.com/reel/Cx1y2z3AbCd/")).toBe("Cx1y2z3AbCd");
    expect(instagramCode("https://instagram.com/reels/Cx1y2z3AbCd")).toBe("Cx1y2z3AbCd");
    expect(instagramCode("https://www.instagram.com/p/Cx1y2z3AbCd/?utm=1")).toBe("Cx1y2z3AbCd");
  });

  it("returns null for a profile link", () => {
    expect(instagramCode("https://www.instagram.com/sharma.realty")).toBeNull();
  });
});

describe("toVideoEmbed", () => {
  it("frames a Short vertically and a normal video horizontally", () => {
    // The whole reason short-form needs its own handling: a 9:16 clip in a
    // 16:9 frame is mostly black bars.
    expect(toVideoEmbed("https://www.youtube.com/shorts/dQw4w9WgXcQ")).toEqual({
      kind: "YOUTUBE_SHORT",
      src: "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ",
      vertical: true,
    });
    expect(toVideoEmbed("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toEqual({
      kind: "YOUTUBE",
      src: "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ",
      vertical: false,
    });
  });

  it("frames an Instagram reel at its embed URL", () => {
    expect(toVideoEmbed("https://www.instagram.com/reel/Cx1y2z3AbCd/")).toEqual({
      kind: "INSTAGRAM_REEL",
      src: "https://www.instagram.com/reel/Cx1y2z3AbCd/embed",
      vertical: true,
    });
  });

  it("uses the privacy-preserving YouTube host", () => {
    expect(toVideoEmbed("https://youtu.be/dQw4w9WgXcQ")?.src).toContain("youtube-nocookie.com");
  });

  it("returns null for anything it cannot frame", () => {
    // The caller then offers a link instead of a frame the browser refuses.
    expect(toVideoEmbed("https://example.com/video.mp4")).toBeNull();
    expect(toVideoEmbed("")).toBeNull();
    expect(toVideoEmbed(null)).toBeNull();
  });
});
