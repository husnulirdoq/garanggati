export const firebaseConfig = {
  apiKey: "AIzaSyAzqxcBSpb8EDiqiMVt48tVuW3ncerE4FI",
  authDomain: "ruang-41bfe.firebaseapp.com",
  projectId: "ruang-41bfe",
  appId: "1:569487423292:web:820be698f0c5122c901039",
};

export const firebaseConfigured = Object.values(firebaseConfig).every(
  (value) => typeof value === "string" && value.length > 0 && !value.startsWith("REPLACE_WITH_"),
);
