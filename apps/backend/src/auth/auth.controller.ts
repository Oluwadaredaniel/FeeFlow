import { Controller, Post, Body, HttpCode, HttpStatus, BadRequestException, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';

@ApiTags('Authentication')
@Controller('api/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Request an OTP for login' })
  async login(@Body('email') email: string) {
    if (!email) {
      throw new BadRequestException('Email address is a required parameter');
    }
    return await this.authService.generateOtp(email);
  }

  @Post('verify-otp')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify OTP and receive JWT' })
  async verifyOtp(@Body('email') email: string, @Body('otp') otp: string) {
    if (!email || !otp) {
      throw new BadRequestException('Both email and OTP verification parameters are required');
    }
    return await this.authService.verifyOtp(email, otp);
  }

  @Post('logout')
  @UseGuards(AuthGuard('jwt'))
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Logout and invalidate session (client-side)' })
  async logout() {
    // In a stateless JWT setup, logout is primarily client-side.
    // However, we can add blacklisting here in the future if needed.
    return {
      success: true,
      message: 'Logged out successfully',
    };
  }
}
