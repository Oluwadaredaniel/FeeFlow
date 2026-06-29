import { Controller, Post, Body, HttpCode, HttpStatus, BadRequestException } from '@nestjs/common';
import { AuthService } from './auth.service';

@Controller('api/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body('email') email: string) {
    if (!email) {
      throw new BadRequestException('Email address is a required parameter');
    }
    return await this.authService.generateOtp(email);
  }

  @Post('verify-otp')
  @HttpCode(HttpStatus.OK)
  async verifyOtp(@Body('email') email: string, @Body('otp') otp: string) {
    if (!email || !otp) {
      throw new BadRequestException('Both email and OTP verification parameters are required');
    }
    return await this.authService.verifyOtp(email, otp);
  }
}