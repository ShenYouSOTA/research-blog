import { describe, expect, test } from "bun:test";
import { getAllPosts, getPostBySlug, getRelatedPosts, getSeriesPosts } from "../../src/lib/markdown";

describe("Integration: Posts", () => {
  test("should load all posts from content directory", () => {
    const posts = getAllPosts();
    expect(posts.length).toBeGreaterThan(0);
    
    // Check if pagination config works with real data count
    // (Optional, just checking we have data)
  });

  test("should load a specific post by slug", () => {
    const posts = getAllPosts();
    if (posts.length > 0) {
      const slug = posts[0].slug;
      const post = getPostBySlug(slug);
      expect(post).not.toBeNull();
      expect(post?.slug).toBe(slug);
    }
  });

  test("should have valid metadata for all posts", () => {
    const posts = getAllPosts();
    posts.forEach(post => {
      expect(post.title).toBeDefined();
      expect(post.date).toBeDefined();
      expect(post.authors.length).toBeGreaterThan(0);
    });
  });

  test("should find related posts", () => {
    const posts = getAllPosts();
    if (posts.length > 1) {
       const firstPost = posts[0];
       const related = getRelatedPosts(firstPost.slug, 2);
       
       expect(Array.isArray(related)).toBe(true);
       expect(related.length).toBeLessThanOrEqual(2);
       
       // Ensure self is not in related
       related.forEach(p => {
         expect(p.slug).not.toBe(firstPost.slug);
       });
    }
  });

  test("should find series posts", () => {
    // We might not have series data in existing posts.
    // But we can test the function call.
    const series = getSeriesPosts("NonExistentSeries");
    expect(series).toEqual([]);
    
    // If we want to test real series, we need to mock data or have a post with series.
    // For now, empty array is a valid result if no series exists.
  });
});
