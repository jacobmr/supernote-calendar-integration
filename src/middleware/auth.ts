import { Request, Response, NextFunction } from "express";

/**
 * Password protection middleware
 * Checks for presence of 'password' cookie
 * If missing, redirects to /login
 * If present and valid, allows request to continue
 */
export function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  // Allow /login route without authentication
  if (req.path === "/login") {
    next();
    return;
  }

  // Check if user has authentication cookie
  const authCookie = req.cookies?.authenticated;

  if (!authCookie) {
    res.redirect("/login");
    return;
  }

  next();
}
