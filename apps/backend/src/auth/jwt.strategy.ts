import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable } from '@nestjs/common';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET || 'fallback_jwt_secret_48_chars_long_minimum',
    });
  }

  async validate(payload: any) {
    // This return object binds directly to req.user for down-stream controller modules
    return {
      userId: payload.sub,
      email: payload.email,
      role: payload.role,
      orgId: payload.org_id,
      matric: payload.matric || null,
    };
  }
}