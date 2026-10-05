import { Body, Controller, Get, HttpCode, Patch, Put } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { AuthUser, CurrentUser } from "../common/decorators";
import { AvailabilityDto } from "./dto";
import { PreferencesService } from "./preferences.service";

@ApiTags("preferences")
@Controller("preferences")
export class PreferencesController {
  constructor(private readonly preferences: PreferencesService) {}

  @Get()
  get(@CurrentUser() user: AuthUser) {
    return this.preferences.getForm(user.id);
  }

  /** The whole form is validated on the server and replaced in one go. */
  @HttpCode(200)
  @Put()
  save(@CurrentUser() user: AuthUser, @Body() body: Record<string, unknown>) {
    return this.preferences.save(user.id, body);
  }

  @Patch("availability")
  availability(@CurrentUser() user: AuthUser, @Body() dto: AvailabilityDto) {
    return this.preferences.setAvailability(user.id, dto.availability);
  }
}
