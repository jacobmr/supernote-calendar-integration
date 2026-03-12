import express, { Request, Response, NextFunction } from "express";
import cookieParser from "cookie-parser";
import SupernoteAPIClient from "./services/supernote-api";
import { authMiddleware } from "./middleware/auth";

const app = express();
const PORT = process.env.PORT || 3000;
const DASHBOARD_PASSWORD = process.env.DASHBOARD_PASSWORD || "admin";

// In-memory session storage (simple single-user app)
interface SessionData {
  supernoteEmail: string;
  supernotePassword: string;
  setupComplete: boolean;
}

const sessionData: SessionData = {
  supernoteEmail: "",
  supernotePassword: "",
  setupComplete: false,
};

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser());

// Authentication middleware (protect all routes except /login)
app.use(authMiddleware);

/**
 * GET /
 * Redirects to /setup on first visit, /dashboard after setup
 */
app.get("/", (req: Request, res: Response): void => {
  if (sessionData.setupComplete) {
    res.redirect("/dashboard");
  } else {
    res.redirect("/setup");
  }
});

/**
 * GET /login
 * Serves a simple login form
 */
app.get("/login", (req: Request, res: Response): void => {
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Dashboard Login</title>
      <style>
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        body {
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
          background: #1a1a1a;
          color: #e0e0e0;
          display: flex;
          justify-content: center;
          align-items: center;
          min-height: 100vh;
          padding: 20px;
        }
        .login-container {
          background: #2d2d2d;
          border-radius: 8px;
          padding: 40px;
          width: 100%;
          max-width: 400px;
          box-shadow: 0 10px 25px rgba(0, 0, 0, 0.3);
        }
        h1 {
          margin-bottom: 30px;
          text-align: center;
          font-size: 24px;
          font-weight: 600;
        }
        .form-group {
          margin-bottom: 20px;
        }
        label {
          display: block;
          margin-bottom: 8px;
          font-size: 14px;
          font-weight: 500;
        }
        input[type="password"] {
          width: 100%;
          padding: 10px 12px;
          border: 1px solid #444;
          border-radius: 4px;
          background: #3a3a3a;
          color: #e0e0e0;
          font-size: 14px;
        }
        input[type="password"]:focus {
          outline: none;
          border-color: #0066cc;
          background: #3f3f3f;
        }
        button {
          width: 100%;
          padding: 10px 12px;
          background: #0066cc;
          color: white;
          border: none;
          border-radius: 4px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: background 0.2s;
        }
        button:hover {
          background: #0052a3;
        }
        .error-message {
          background: #3d1a1a;
          color: #ff6b6b;
          padding: 12px;
          border-radius: 4px;
          margin-bottom: 20px;
          font-size: 14px;
          display: none;
        }
        .error-message.show {
          display: block;
        }
      </style>
    </head>
    <body>
      <div class="login-container">
        <h1>Dashboard Access</h1>
        <div class="error-message" id="errorMessage"></div>
        <form method="POST" action="/login">
          <div class="form-group">
            <label for="password">Password</label>
            <input type="password" id="password" name="password" required autofocus>
          </div>
          <button type="submit">Sign In</button>
        </form>
      </div>
    </body>
    </html>
  `);
});

/**
 * POST /login
 * Validates password and sets authentication cookie
 */
app.post("/login", (req: Request, res: Response): void => {
  const { password } = req.body;

  if (!password) {
    res.status(400).send("Password is required");
    return;
  }

  if (password === DASHBOARD_PASSWORD) {
    // Set httpOnly cookie for authentication
    res.cookie("authenticated", "true", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    });

    // Redirect to setup or dashboard
    const redirectTo = sessionData.setupComplete ? "/dashboard" : "/setup";
    res.redirect(redirectTo);
  } else {
    res.status(401).send(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Login Failed</title>
        <style>
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            background: #1a1a1a;
            color: #e0e0e0;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            padding: 20px;
          }
          .error-container {
            background: #2d2d2d;
            border-radius: 8px;
            padding: 40px;
            width: 100%;
            max-width: 400px;
            box-shadow: 0 10px 25px rgba(0, 0, 0, 0.3);
            text-align: center;
          }
          .error-message {
            background: #3d1a1a;
            color: #ff6b6b;
            padding: 12px;
            border-radius: 4px;
            margin-bottom: 20px;
            font-size: 14px;
          }
          h2 {
            margin-bottom: 20px;
            font-size: 20px;
            font-weight: 600;
          }
          a {
            color: #0066cc;
            text-decoration: none;
            font-weight: 600;
          }
          a:hover {
            text-decoration: underline;
          }
        </style>
      </head>
      <body>
        <div class="error-container">
          <h2>Incorrect Password</h2>
          <div class="error-message">The password you entered is not correct. Please try again.</div>
          <p><a href="/login">Back to Login</a></p>
        </div>
      </body>
      </html>
    `);
  }
});

/**
 * GET /setup
 * Serves the setup form
 */
app.get("/setup", (req: Request, res: Response): void => {
  const setupHtml = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Setup - Supernote Calendar Integration</title>
      <style>
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        body {
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
          background: #1a1a1a;
          color: #e0e0e0;
          min-height: 100vh;
          padding: 20px;
        }
        .container {
          max-width: 600px;
          margin: 40px auto;
        }
        h1 {
          font-size: 32px;
          margin-bottom: 10px;
          font-weight: 600;
        }
        .subtitle {
          color: #999;
          margin-bottom: 40px;
          font-size: 16px;
        }
        .form-section {
          background: #2d2d2d;
          padding: 30px;
          border-radius: 8px;
          margin-bottom: 30px;
        }
        .form-section h2 {
          font-size: 18px;
          margin-bottom: 20px;
          font-weight: 600;
        }
        .form-group {
          margin-bottom: 20px;
        }
        .form-group:last-child {
          margin-bottom: 0;
        }
        label {
          display: block;
          margin-bottom: 8px;
          font-size: 14px;
          font-weight: 500;
          color: #e0e0e0;
        }
        input[type="email"],
        input[type="password"] {
          width: 100%;
          padding: 10px 12px;
          border: 1px solid #444;
          border-radius: 4px;
          background: #3a3a3a;
          color: #e0e0e0;
          font-size: 14px;
          font-family: inherit;
        }
        input[type="email"]:focus,
        input[type="password"]:focus {
          outline: none;
          border-color: #0066cc;
          background: #3f3f3f;
        }
        .button-group {
          display: flex;
          gap: 10px;
          margin-top: 30px;
        }
        button {
          flex: 1;
          padding: 12px;
          border: none;
          border-radius: 4px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: background 0.2s;
        }
        .primary-button {
          background: #0066cc;
          color: white;
        }
        .primary-button:hover {
          background: #0052a3;
        }
        .secondary-button {
          background: #444;
          color: #e0e0e0;
        }
        .secondary-button:hover {
          background: #555;
        }
        .error-message {
          background: #3d1a1a;
          color: #ff6b6b;
          padding: 12px;
          border-radius: 4px;
          margin-bottom: 20px;
          font-size: 14px;
          display: none;
        }
        .error-message.show {
          display: block;
        }
        .info-text {
          color: #999;
          font-size: 13px;
          margin-top: 8px;
        }
        .loading {
          display: none;
        }
        button.loading-state {
          opacity: 0.7;
          cursor: not-allowed;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>Setup Supernote Integration</h1>
        <p class="subtitle">Enter your Supernote login credentials to continue</p>

        <form id="setupForm" method="POST" action="/api/setup">
          <div class="form-section">
            <h2>Step 1: Supernote Credentials</h2>

            <div class="error-message" id="errorMessage"></div>

            <div class="form-group">
              <label for="email">Supernote Email</label>
              <input
                type="email"
                id="email"
                name="email"
                required
                placeholder="your.email@example.com"
                autocomplete="email"
              >
              <p class="info-text">Your Supernote account email address</p>
            </div>

            <div class="form-group">
              <label for="password">Supernote Password</label>
              <input
                type="password"
                id="password"
                name="password"
                required
                placeholder="••••••••"
                autocomplete="current-password"
              >
              <p class="info-text">Your Supernote account password</p>
            </div>

            <div class="button-group">
              <button type="submit" class="primary-button" id="submitBtn">
                <span id="submitText">Validate Credentials</span>
                <span id="submitLoading" class="loading">Validating...</span>
              </button>
            </div>
          </div>
        </form>
      </div>

      <script>
        const form = document.getElementById('setupForm');
        const errorMessage = document.getElementById('errorMessage');
        const submitBtn = document.getElementById('submitBtn');
        const submitText = document.getElementById('submitText');
        const submitLoading = document.getElementById('submitLoading');

        form.addEventListener('submit', async (e) => {
          e.preventDefault();

          // Hide error message
          errorMessage.classList.remove('show');

          // Show loading state
          submitBtn.disabled = true;
          submitBtn.classList.add('loading-state');
          submitText.style.display = 'none';
          submitLoading.style.display = 'inline';

          const email = document.getElementById('email').value;
          const password = document.getElementById('password').value;

          try {
            const response = await fetch('/api/setup', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ email, password }),
            });

            if (response.ok) {
              // Redirect to dashboard on success
              window.location.href = '/dashboard';
            } else {
              const data = await response.json();
              errorMessage.textContent = data.error || 'Invalid credentials. Please try again.';
              errorMessage.classList.add('show');

              // Reset loading state
              submitBtn.disabled = false;
              submitBtn.classList.remove('loading-state');
              submitText.style.display = 'inline';
              submitLoading.style.display = 'none';
            }
          } catch (error) {
            errorMessage.textContent = 'An error occurred. Please try again.';
            errorMessage.classList.add('show');

            // Reset loading state
            submitBtn.disabled = false;
            submitBtn.classList.remove('loading-state');
            submitText.style.display = 'inline';
            submitLoading.style.display = 'none';
          }
        });
      </script>
    </body>
    </html>
  `;

  res.send(setupHtml);
});

/**
 * POST /api/setup
 * Validates Supernote credentials and stores them in session
 */
app.post("/api/setup", async (req: Request, res: Response): Promise<void> => {
  const { email, password } = req.body;

  // Validate input
  if (!email || !password) {
    res.status(400).json({
      error: "Email and password are required",
    });
    return;
  }

  try {
    // Validate credentials against Supernote API
    const client = new SupernoteAPIClient();
    await client.authenticate(email, password);

    // Store credentials in session (in-memory, for this session lifetime)
    sessionData.supernoteEmail = email;
    sessionData.supernotePassword = password;
    sessionData.setupComplete = true;

    console.log(`Setup complete for ${email}`);
    res.status(200).json({
      success: true,
      message: "Credentials validated successfully",
    });
  } catch (error) {
    console.error("Supernote authentication failed:", error);

    res.status(400).json({
      error:
        "Invalid Supernote credentials. Please check your email and password.",
    });
  }
});

/**
 * GET /dashboard
 * Serves the dashboard (will be implemented in next plan)
 */
app.get("/dashboard", (req: Request, res: Response): void => {
  if (!sessionData.setupComplete) {
    res.redirect("/setup");
    return;
  }

  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Dashboard - Supernote Calendar Integration</title>
      <style>
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        body {
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
          background: #1a1a1a;
          color: #e0e0e0;
          min-height: 100vh;
          padding: 20px;
        }
        .container {
          max-width: 600px;
          margin: 40px auto;
        }
        h1 {
          font-size: 32px;
          margin-bottom: 30px;
          font-weight: 600;
        }
        .status-card {
          background: #2d2d2d;
          padding: 30px;
          border-radius: 8px;
          margin-bottom: 20px;
        }
        .status-label {
          color: #999;
          font-size: 13px;
          margin-bottom: 8px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .status-value {
          font-size: 24px;
          font-weight: 600;
        }
        .info-text {
          color: #999;
          font-size: 14px;
          margin-top: 20px;
          padding-top: 20px;
          border-top: 1px solid #444;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>Dashboard</h1>
        <div class="status-card">
          <div class="status-label">Status</div>
          <div class="status-value">Setup Complete</div>
          <div class="info-text">
            Your Supernote credentials have been validated and stored. The dashboard will display your meeting synchronization status here.
          </div>
        </div>
      </div>
    </body>
    </html>
  `);
});

/**
 * 404 Handler
 */
app.use((req: Request, res: Response): void => {
  res.status(404).send("Not Found");
});

/**
 * Error handler
 */
app.use((err: Error, req: Request, res: Response, next: NextFunction): void => {
  console.error("Server error:", err);
  res.status(500).send("Internal Server Error");
});

// Start server
const server = app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

// Graceful shutdown when parent process exits
process.on("SIGTERM", () => {
  console.log("SIGTERM received, shutting down gracefully...");
  server.close(() => {
    console.log("Server closed");
    process.exit(0);
  });
});

process.on("SIGINT", () => {
  console.log("SIGINT received, shutting down gracefully...");
  server.close(() => {
    console.log("Server closed");
    process.exit(0);
  });
});

export default app;
