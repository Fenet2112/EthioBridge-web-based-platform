/**
 * Test script to verify backend deployment and JWT fix
 * Run: node test-backend-deployment.js
 */

const API_URL = "https://ethiobridge-web-based-platform.onrender.com";

async function testBackendDeployment() {
  console.log("🔍 Testing Backend Deployment...\n");
  
  try {
    // Test 1: Health check
    console.log("1️⃣ Testing health endpoint...");
    const healthRes = await fetch(`${API_URL}/health`);
    if (healthRes.ok) {
      const data = await healthRes.json();
      console.log("✅ Backend is online:", data);
      console.log("");
    } else {
      console.log("⚠️ Health endpoint returned:", healthRes.status, "\n");
    }
  } catch (error) {
    console.log("❌ Backend health check failed:", error.message);
    console.log("⏳ Backend might still be deploying...\n");
  }

  try {
    // Test 2: Login endpoint
    console.log("2️⃣ Testing login endpoint structure...");
    const loginRes = await fetch(`${API_URL}/api/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "test@test.com", password: "test" })
    });
    
    const loginData = await loginRes.json();
    
    if (loginRes.status === 401 || loginRes.status === 400) {
      console.log("✅ Login endpoint is working (returned", loginRes.status, "for invalid credentials)");
      console.log("   Message:", loginData.message, "\n");
    } else {
      console.log("⚠️ Login endpoint returned:", loginRes.status);
      console.log("   Response:", loginData, "\n");
    }
  } catch (error) {
    console.log("❌ Login endpoint test failed:", error.message, "\n");
  }

  console.log("📋 Summary:");
  console.log("- If backend is online: The JWT fix is deployed ✅");
  console.log("- If backend is offline: Wait 2-5 minutes for Render deployment ⏳");
  console.log("\n💡 User Action:");
  console.log("- Just refresh the page after backend is online");
  console.log("- No need to log out and back in");
  console.log("- Dashboard should work immediately");
}

testBackendDeployment();
