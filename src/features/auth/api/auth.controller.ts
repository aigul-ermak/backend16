import {Body, Controller, Get, HttpCode, Post, Req, Res, UnauthorizedException, UseGuards,} from '@nestjs/common';

import {Request, Response} from 'express';
import {UserLoginDto} from "./models/input/login-user.input.dto";
import {CreateUserDto} from "../../users/api/models/input/create-user.input.dto";
import {EmailDto} from "../../email/models/input/email.input.dto";
import {CommandBus} from "@nestjs/cqrs";
import {LoginUserUseCaseCommand} from "./usecases/loginUserUseCase";
import {ConfirmEmailUseCaseCommand} from "./usecases/confirmEmailUseCase";
import {CreateUserRegistrationUseCaseCommand} from "./usecases/createUserRegistrationUseCase";
import {SendNewCodeToEmailUseCaseCommand} from "./usecases/sendNewCodeToEmailUseCase";
import {GetMeUseCaseCommand} from "./usecases/getMeUseCase";
import {LogoutUserUseCaseCommand} from "./usecases/logoutUserUseCase";
import {JwtAuthGuard} from "../../../infrastructure/guards/jwt-auth.guard";
import {RefreshTokenGuard} from "../../../infrastructure/guards/refresh-token.guard";
import {RefreshTokensUseCaseCommand} from "./usecases/refreshTokensUserUseCase";
import {Throttle, ThrottlerGuard} from "@nestjs/throttler";
import {PasswordRecoveryUseCaseCommand} from "./usecases/passwordRecoveryUseCase";
import {NewPasswordDto} from "./models/input/new-password.input.dto";
import {CreateNewPasswordUseCaseCommand} from "./usecases/createNewPasswordUseCase";
import {PasswordRecoveryCodeGuard} from "../../../infrastructure/guards/passwordRecoveryCode.guard";

@UseGuards(ThrottlerGuard)
@Controller('auth')
export class AuthController {

    constructor(
        private commandBus: CommandBus,
    ) {
    }


    @Post('/login')
    @HttpCode(200)
    async login(@Body() loginDto: UserLoginDto,
                @Req() req: Request,
                @Res() res: Response,) {

        const userIP: string = req.ip ?? "testuserip";
        const userAgent: string = req.headers['user-agent'] ?? "user-agent";

        const {
            accessToken,
            refreshToken
        } = await this.commandBus
            .execute(new LoginUserUseCaseCommand(loginDto, userIP, userAgent));

        res.cookie('refreshToken', refreshToken, {
            httpOnly: true,
            secure: true,
            sameSite: 'strict',
            maxAge: 7 * 24 * 60 * 60 * 1000,
        });

        return res.json({accessToken});

    }


    //Even if current email is not registered (for prevent user's email detection)

    @Post('/password-recovery')
    @HttpCode(204)
    async recoveryPassword(
        @Body() email: EmailDto) {

        await this.commandBus.execute(new PasswordRecoveryUseCaseCommand(email));

    }

    @Post('/new-password')
    @UseGuards(PasswordRecoveryCodeGuard)
    @HttpCode(204)
    async createNewPassword(
        @Body()
            newPasswordDto: NewPasswordDto) {

        await this.commandBus.execute(new CreateNewPasswordUseCaseCommand(newPasswordDto));

    }


    @Post('/registration-confirmation')
    @HttpCode(204)
    async confirmRegistration(@Body('code') code: string) {

        await this.commandBus.execute(new ConfirmEmailUseCaseCommand(code));

    }


    @Post('/registration')
    @HttpCode(204)
    async registration(
        @Body() createUserDto: CreateUserDto) {

        await this.commandBus.execute(new CreateUserRegistrationUseCaseCommand(createUserDto));

    }

    @Post('/refresh-token')
    @HttpCode(200)
    @UseGuards(RefreshTokenGuard)
    async refreshToken(
        @Req() request: Request,
        @Res() res: Response) {

        if (!request.user) throw new UnauthorizedException('User info was not provided')
        const {userId, deviceId, userIP, userAgent} = request.user

        const {
            accessToken,
            refreshToken
        } = await this.commandBus.execute(new RefreshTokensUseCaseCommand(userId, deviceId, userIP, userAgent));


        res.cookie('refreshToken', refreshToken, {
            httpOnly: true,
            secure: true,
            sameSite: 'strict',
            maxAge: 7 * 24 * 60 * 60 * 1000,
        });

        return res.json({accessToken});
    }


    @Post('/registration-email-resending')
    @HttpCode(204)
    async sendNewCodeToEmail(@Body() resendEmailDto: EmailDto) {

        await this.commandBus.execute(new SendNewCodeToEmailUseCaseCommand(resendEmailDto));

    }


    @Get('/me')
    @HttpCode(200)
    @UseGuards(JwtAuthGuard)
    async getUser(
        @Req() request: Request
    ) {
        if (!request.user) throw new UnauthorizedException('User info was not provided')

        const {userId} = request.user;

        return this.commandBus.execute(new GetMeUseCaseCommand(userId));

    }

    @Post('/logout')
    @HttpCode(204)
    @UseGuards(RefreshTokenGuard)
    async logoutUser(
        @Req() request: Request, @Res() res: Response) {

        if (!request.user) throw new UnauthorizedException('User info was not provided')

        const {userId, deviceId} = request.user

        await this.commandBus.execute(new LogoutUserUseCaseCommand(userId, deviceId));

        res.clearCookie('refreshToken', {
            httpOnly: true,
            secure: true,
            sameSite: 'strict',
        });

        res.send();
    }
}

