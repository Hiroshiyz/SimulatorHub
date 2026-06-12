import { createParamDecorator, ExecutionContext } from "@nestjs/common";

export interface PartyContext {
  id: string;
  countryCode: string;
  partyId: string;
  role: string;
  name?: string;
}

export const CurrentParty = createParamDecorator(
  (data: keyof PartyContext | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const party = request.party as PartyContext | undefined;
    
    if (!party) {
      return null;
    }
    
    return data ? party[data] : party;
  },
);
