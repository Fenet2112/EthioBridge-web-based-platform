/**
 * Test script to verify recommendation system input validation
 * Tests that the system properly handles empty input vs. valid input
 */

const API_BASE = process.env.API_URL || "http://localhost:5000";
const ML_SERVICE = process.env.ML_SERVICE_URL || "http://localhost:8000";

async function testRecommendations() {
  console.log("=".repeat(60));
  console.log("RECOMMENDATION SYSTEM INPUT VALIDATION TEST");
  console.log("=".repeat(60));

  // Test 1: ML Service Health Check
  console.log("\n1. Testing ML Service Health...");
  try {
    const res = await fetch(`${ML_SERVICE}/health`);
    const data = await res.json();
    console.log("✓ ML Service Status:", data.status);
    console.log("  Model Loaded:", data.model_loaded);
    console.log("  Model Version:", data.model_version || "N/A");
  } catch (err) {
    console.log("✗ ML Service unavailable:", err.message);
  }

  // Test 2: Empty Input (should return popular items)
  console.log("\n2. Testing Empty Input (no category, no budget)...");
  try {
    const params = new URLSearchParams({
      user_id: 1,
      category: "",
      budget: 0,
      top_n: 5,
    });
    const res = await fetch(`${ML_SERVICE}/recommend/products?${params}`);
    const data = await res.json();
    console.log("✓ Response received");
    console.log("  Recommendation Type:", data.recommendation_type);
    console.log("  Number of results:", data.recommendations?.length || 0);
    
    if (data.recommendation_type === "popular") {
      console.log("  ✓ Correctly identified as POPULAR recommendations");
    } else {
      console.log("  ⚠ Expected 'popular' but got:", data.recommendation_type);
    }
  } catch (err) {
    console.log("✗ Test failed:", err.message);
  }

  // Test 3: Category Only (should return content-based)
  console.log("\n3. Testing Category Input (Cement, no budget)...");
  try {
    const params = new URLSearchParams({
      user_id: 1,
      category: "Cement",
      budget: 0,
      top_n: 5,
    });
    const res = await fetch(`${ML_SERVICE}/recommend/products?${params}`);
    const data = await res.json();
    console.log("✓ Response received");
    console.log("  Recommendation Type:", data.recommendation_type);
    console.log("  Number of results:", data.recommendations?.length || 0);
    
    if (data.recommendation_type === "content_based" || data.recommendation_type === "personalized") {
      console.log("  ✓ Correctly identified as CONTENT-BASED recommendations");
    } else {
      console.log("  ⚠ Expected 'content_based' but got:", data.recommendation_type);
    }
  } catch (err) {
    console.log("✗ Test failed:", err.message);
  }

  // Test 4: Budget Only (should return content-based)
  console.log("\n4. Testing Budget Input (50000 ETB, no category)...");
  try {
    const params = new URLSearchParams({
      user_id: 1,
      category: "",
      budget: 50000,
      top_n: 5,
    });
    const res = await fetch(`${ML_SERVICE}/recommend/products?${params}`);
    const data = await res.json();
    console.log("✓ Response received");
    console.log("  Recommendation Type:", data.recommendation_type);
    console.log("  Number of results:", data.recommendations?.length || 0);
    
    if (data.recommendation_type === "content_based" || data.recommendation_type === "personalized") {
      console.log("  ✓ Correctly identified as CONTENT-BASED recommendations");
    } else {
      console.log("  ⚠ Expected 'content_based' but got:", data.recommendation_type);
    }
  } catch (err) {
    console.log("✗ Test failed:", err.message);
  }

  // Test 5: Both Category and Budget (should return content-based or personalized)
  console.log("\n5. Testing Full Input (Steel + 100000 ETB)...");
  try {
    const params = new URLSearchParams({
      user_id: 1,
      category: "Steel",
      budget: 100000,
      top_n: 5,
    });
    const res = await fetch(`${ML_SERVICE}/recommend/products?${params}`);
    const data = await res.json();
    console.log("✓ Response received");
    console.log("  Recommendation Type:", data.recommendation_type);
    console.log("  Number of results:", data.recommendations?.length || 0);
    
    if (data.recommendation_type === "content_based" || data.recommendation_type === "personalized" || data.recommendation_type === "collaborative") {
      console.log("  ✓ Correctly identified as PERSONALIZED recommendations");
    } else {
      console.log("  ⚠ Unexpected type:", data.recommendation_type);
    }
    
    // Check if results respect budget
    if (data.recommendations?.length > 0) {
      const overBudget = data.recommendations.filter(r => r.over_budget);
      console.log("  Over-budget items:", overBudget.length);
    }
  } catch (err) {
    console.log("✗ Test failed:", err.message);
  }

  // Test 6: Industry Recommendations - Empty Input
  console.log("\n6. Testing Industry Recommendations (empty input)...");
  try {
    const params = new URLSearchParams({
      user_id: 1,
      category: "",
      budget: 0,
      top_n: 5,
    });
    const res = await fetch(`${ML_SERVICE}/recommend/industries?${params}`);
    const data = await res.json();
    console.log("✓ Response received");
    console.log("  Recommendation Type:", data.recommendation_type);
    console.log("  Number of results:", data.recommendations?.length || 0);
    
    if (data.recommendation_type === "popular") {
      console.log("  ✓ Correctly identified as POPULAR recommendations");
    } else {
      console.log("  ⚠ Expected 'popular' but got:", data.recommendation_type);
    }
  } catch (err) {
    console.log("✗ Test failed:", err.message);
  }

  console.log("\n" + "=".repeat(60));
  console.log("TEST SUMMARY");
  console.log("=".repeat(60));
  console.log("✓ All tests completed");
  console.log("\nExpected Behavior:");
  console.log("- Empty input → recommendation_type: 'popular'");
  console.log("- Category or budget → recommendation_type: 'content_based'");
  console.log("- User with history → recommendation_type: 'collaborative' or 'personalized'");
  console.log("\nThe system should now provide clear feedback about why");
  console.log("recommendations are shown, avoiding 'random' results.");
  console.log("=".repeat(60));
}

testRecommendations().catch(console.error);
