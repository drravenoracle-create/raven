import test from "node:test";
import assert from "node:assert/strict";
import { buildCalendarBlog, buildCalendarSocial, buildDailyAlmanac } from "../app/lib/calendar/daily-almanac.ts";

test("Blog and SNS derivatives share the same confirmed almanac", () => {
  const almanac = buildDailyAlmanac("2026-08-21");
  const blog = buildCalendarBlog(almanac);
  const video = buildCalendarSocial(almanac, "short_video");
  const carousel = buildCalendarSocial(almanac, "carousel");
  assert.match(blog.title, /丁卯/);
  assert.match(video.caption, /丁卯/);
  assert.match(carousel.caption, /丁卯/);
  assert.equal(almanac.contentType, "daily_calendar");
});
