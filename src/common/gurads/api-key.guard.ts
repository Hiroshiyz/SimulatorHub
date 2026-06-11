import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";

@Injectable()
export class ApiKeyGuard implements CanActivate {
  private readonly tokenB = process.env.CREDENTIALS_TOKEN_B || "mock_token_b_12345";

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers["authorization"];

    if (!authHeader) {
      throw new UnauthorizedException("Missing Authorization header");
    }

    // Parse format "Token <token>" or "Bearer <token>"
    const parts = authHeader.split(" ");
    if (parts.length !== 2 || (parts[0] !== "Token" && parts[0] !== "Bearer")) {
      throw new UnauthorizedException("Invalid Authorization header format");
    }

    const token = parts[1];
    if (token !== this.tokenB) {
      throw new UnauthorizedException("Invalid OCPI credentials");
    }

    return true;
  }
}
