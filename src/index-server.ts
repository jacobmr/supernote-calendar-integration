import express, { Request, Response, NextFunction } from "express";
import cookieParser from "cookie-parser";
import * as fs from "fs";
import * as path from "path";
import { authMiddleware } from "./middleware/auth";

const app = express();
const PORT = process.env.PORT || 3000;
const DASHBOARD_PASSWORD = process.env.DASHBOARD_PASSWORD || "admin";

// Paths for state files
const MEETING_STATE_PATH = path.join(
  process.cwd(),
  "data",
  "meeting-state.json",
);
const SCHEDULER_STATUS_PATH = path.join(
  process.cwd(),
  "data",
  "scheduler-status.json",
);

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
    // Validate credentials against Supernote API (dynamic import for ESM compatibility)
    const { default: SupernoteAPIClient } =
      await import("./services/supernote-api");
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
 * Serves the meeting summary dashboard
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
      <title>Meeting Summary - Supernote Calendar Integration</title>
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
        .header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 30px;
        }
        h1 {
          font-size: 32px;
          font-weight: 600;
        }
        .logout-link {
          color: #999;
          text-decoration: none;
          font-size: 14px;
          padding: 8px 16px;
          border: 1px solid #444;
          border-radius: 4px;
          transition: all 0.2s;
        }
        .logout-link:hover {
          color: #e0e0e0;
          border-color: #666;
        }
        .last-updated {
          color: #999;
          font-size: 14px;
          margin-bottom: 30px;
        }
        .status-indicator {
          display: inline-block;
          padding: 4px 12px;
          border-radius: 12px;
          font-size: 13px;
          font-weight: 500;
          margin-bottom: 30px;
        }
        .status-idle {
          background: #1a3a1a;
          color: #6bcf6b;
        }
        .status-running {
          background: #3a3a1a;
          color: #cfcf6b;
        }
        .status-never {
          background: #2d2d2d;
          color: #999;
        }
        .metrics {
          display: flex;
          gap: 15px;
          margin-bottom: 30px;
        }
        .metric-card {
          flex: 1;
          background: #2d2d2d;
          padding: 24px 20px;
          border-radius: 8px;
          text-align: center;
        }
        .metric-count {
          font-size: 36px;
          font-weight: 700;
          margin-bottom: 8px;
        }
        .metric-label {
          color: #999;
          font-size: 14px;
        }
        .metric-new .metric-count { color: #6bcf6b; }
        .metric-changed .metric-count { color: #cfcf6b; }
        .metric-cancelled .metric-count { color: #ff6b6b; }
        .trigger-section {
          background: #2d2d2d;
          padding: 24px;
          border-radius: 8px;
          margin-bottom: 20px;
        }
        .trigger-section p {
          color: #999;
          font-size: 14px;
          margin-bottom: 16px;
        }
        .trigger-btn {
          padding: 10px 20px;
          background: #0066cc;
          color: white;
          border: none;
          border-radius: 4px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: background 0.2s;
        }
        .trigger-btn:hover {
          background: #0052a3;
        }
        .trigger-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
        .trigger-result {
          margin-top: 12px;
          font-size: 14px;
          display: none;
        }
        .info-footer {
          color: #666;
          font-size: 13px;
          text-align: center;
          margin-top: 40px;
        }
        .loading-text {
          color: #999;
          font-size: 14px;
          text-align: center;
          padding: 40px;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Meeting Summary</h1>
          <a href="/logout" class="logout-link">Log out</a>
        </div>

        <div id="lastUpdated" class="last-updated">Loading...</div>
        <div id="statusBadge" class="status-indicator status-never">Loading</div>

        <div class="metrics">
          <div class="metric-card metric-new">
            <div class="metric-count" id="countNew">-</div>
            <div class="metric-label">New meetings</div>
          </div>
          <div class="metric-card metric-changed">
            <div class="metric-count" id="countChanged">-</div>
            <div class="metric-label">Changed</div>
          </div>
          <div class="metric-card metric-cancelled">
            <div class="metric-count" id="countCancelled">-</div>
            <div class="metric-label">Cancelled</div>
          </div>
        </div>

        <div class="trigger-section">
          <p>Manually check for calendar changes now:</p>
          <button class="trigger-btn" id="triggerBtn" onclick="triggerScheduler()">Run scheduler now</button>
          <div class="trigger-result" id="triggerResult"></div>
        </div>

        <div class="info-footer">
          Scheduler checks automatically every hour
        </div>
      </div>

      <script>
        async function loadStatus() {
          try {
            const response = await fetch('/api/status');
            if (!response.ok) return;
            const data = await response.json();

            // Update last run time
            var lastUpdatedEl = document.getElementById('lastUpdated');
            if (data.lastRun) {
              var d = new Date(data.lastRun);
              var now = new Date();
              var diffMs = now.getTime() - d.getTime();
              var diffMins = Math.floor(diffMs / 60000);
              var timeAgo;
              if (diffMins < 1) timeAgo = 'just now';
              else if (diffMins < 60) timeAgo = diffMins + ' minute' + (diffMins === 1 ? '' : 's') + ' ago';
              else {
                var diffHours = Math.floor(diffMins / 60);
                timeAgo = diffHours + ' hour' + (diffHours === 1 ? '' : 's') + ' ago';
              }
              lastUpdatedEl.textContent = 'Last updated: ' + timeAgo;
            } else {
              lastUpdatedEl.textContent = 'Scheduler has not run yet';
            }

            // Update status badge
            var badge = document.getElementById('statusBadge');
            if (data.status === 'running') {
              badge.textContent = 'Status: Running';
              badge.className = 'status-indicator status-running';
            } else if (data.lastRun) {
              badge.textContent = 'Status: Idle';
              badge.className = 'status-indicator status-idle';
            } else {
              badge.textContent = 'Status: Waiting for first run';
              badge.className = 'status-indicator status-never';
            }

            // Update counts
            document.getElementById('countNew').textContent = data.summary.new;
            document.getElementById('countChanged').textContent = data.summary.changed;
            document.getElementById('countCancelled').textContent = data.summary.cancelled;
          } catch (err) {
            console.error('Failed to load status:', err);
          }
        }

        async function triggerScheduler() {
          var btn = document.getElementById('triggerBtn');
          var result = document.getElementById('triggerResult');
          if (!confirm('Run scheduler now?')) return;

          btn.disabled = true;
          btn.textContent = 'Running...';
          result.style.display = 'none';

          try {
            var response = await fetch('/api/trigger', { method: 'POST' });
            var data = await response.json();
            result.textContent = data.message || 'Scheduler triggered';
            result.style.color = response.ok ? '#6bcf6b' : '#ff6b6b';
            result.style.display = 'block';
            if (response.ok) {
              // Reload status after a brief delay
              setTimeout(loadStatus, 2000);
            }
          } catch (err) {
            result.textContent = 'Failed to trigger scheduler';
            result.style.color = '#ff6b6b';
            result.style.display = 'block';
          }

          btn.disabled = false;
          btn.textContent = 'Run scheduler now';
        }

        // Load status on page load
        loadStatus();
      </script>
    </body>
    </html>
  `);
});

/**
 * GET /api/status
 * Returns current meeting state summary as JSON
 */
app.get("/api/status", (req: Request, res: Response): void => {
  try {
    // Try to read scheduler status (written by scheduler after each run)
    let lastRun: string | null = null;
    let summary = { new: 0, changed: 0, cancelled: 0 };
    let status = "idle";

    if (fs.existsSync(SCHEDULER_STATUS_PATH)) {
      const statusData = JSON.parse(
        fs.readFileSync(SCHEDULER_STATUS_PATH, "utf-8"),
      );
      lastRun = statusData.lastRun || null;
      summary = statusData.summary || summary;
      status = statusData.status || "idle";
    } else if (fs.existsSync(MEETING_STATE_PATH)) {
      // Fallback: if scheduler-status.json doesn't exist yet but meetings do,
      // use file modification time as lastRun
      const stats = fs.statSync(MEETING_STATE_PATH);
      lastRun = stats.mtime.toISOString();
    }

    res.json({ lastRun, summary, status });
  } catch (error) {
    console.error("Error reading meeting state:", error);
    res.json({
      lastRun: null,
      summary: { new: 0, changed: 0, cancelled: 0 },
      status: "idle",
    });
  }
});

/**
 * POST /api/trigger
 * Placeholder for manual scheduler trigger (future implementation)
 */
app.post("/api/trigger", (req: Request, res: Response): void => {
  res.json({
    message:
      "Manual trigger is not yet implemented. The scheduler runs automatically every hour.",
  });
});

/**
 * GET /logout
 * Clears authentication cookie and redirects to login
 */
app.get("/logout", (req: Request, res: Response): void => {
  res.clearCookie("authenticated");
  res.redirect("/login");
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
