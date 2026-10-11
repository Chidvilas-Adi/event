import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth/get-user';
import { InvestorPacketService } from '@/lib/investor/packet-service';

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) {
    return NextResponse.json({ error: 'UNAUTHORIZED: Session required.' }, { status: 401 });
  }

  // Investors, GMs, Admins, Observers can view all packets.
  // Founders can view their own company packet.
  if (user.role !== 'gm' && user.role !== 'admin' && user.role !== 'volunteer' && user.role !== 'observer') {
    if (user.role === 'company_lead' && user.companyId) {
      const packet = await InvestorPacketService.generatePacketForCompany(user.companyId);
      return NextResponse.json({ packets: [packet] });
    }
    return NextResponse.json({ error: 'FORBIDDEN: Investor or Executive access required.' }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const companyId = searchParams.get('companyId');

  if (companyId) {
    const packet = await InvestorPacketService.generatePacketForCompany(companyId);
    return NextResponse.json({ packet });
  }

  const packets = await InvestorPacketService.generateAllPackets();
  return NextResponse.json({ packets });
}
