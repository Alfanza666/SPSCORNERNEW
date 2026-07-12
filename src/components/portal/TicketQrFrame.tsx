import QRCode from 'react-qr-code';
import FederasiLogo from '../ui/federasi-logo.png';
import FrameBackground from '../ui/Frame QR.png';
import SpsLogo from '../ui/logo-landscape.webp';
import SariRotiLogo from '../ui/logo_sariroti_group.png';

interface TicketQrFrameProps {
  programName: string;
  ticketTitle: string;
  qrValue: string;
  name: string;
  nik?: string;
  beneficiaryLabel?: string;
  code?: string;
  status?: string;
  className?: string;
}

export default function TicketQrFrame({
  programName,
  ticketTitle,
  qrValue,
  name,
  nik,
  beneficiaryLabel,
  code,
  status,
  className = '',
}: TicketQrFrameProps) {
  return (
    <article className={`relative mx-auto aspect-square w-full max-w-[34rem] overflow-hidden rounded-[2rem] bg-white text-slate-950 shadow-2xl ${className}`}>
      <img src={FrameBackground} alt="" aria-hidden="true" className="absolute inset-0 h-full w-full object-cover" />

      <img src={SariRotiLogo} alt="Sari Roti Group" className="absolute left-[7%] top-[6.5%] h-[8.5%] w-auto max-w-[22%] object-contain" />
      <img src={FederasiLogo} alt="Federasi SPS" className="absolute right-[7%] top-[6%] h-[10%] w-auto max-w-[18%] object-contain" />

      <section className="absolute left-[15%] right-[15%] top-[15%] text-center">
        <p className="text-[9px] font-black uppercase tracking-[0.22em] text-amber-500 sm:text-[11px]">{beneficiaryLabel || 'Peserta'}</p>
        <h2 className="mt-1 text-base font-black uppercase leading-tight text-blue-900 drop-shadow-[0_1px_0_rgba(255,255,255,0.75)] sm:text-2xl">{programName}</h2>
        <p className="mt-1 text-xs font-black uppercase tracking-[0.16em] text-slate-700 sm:text-base">{ticketTitle}</p>
      </section>

      <div className="absolute left-1/2 top-[55%] flex aspect-square w-[36%] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-[1.25rem] bg-white p-[2.4%] shadow-[0_16px_45px_-28px_rgba(30,64,175,0.9)]">
        <QRCode value={qrValue} size={240} bgColor="#ffffff" fgColor="#0f172a" level="H" style={{ width: '100%', height: '100%' }} />
      </div>

      <span className="absolute left-[16.5%] top-[85.2%] max-w-[43%] truncate text-[11px] font-black uppercase text-slate-900 sm:text-base">{name || '-'}</span>
      <span className="absolute left-[16.5%] top-[91%] max-w-[43%] truncate font-mono text-[10px] font-black text-slate-900 sm:text-sm">{nik || '-'}</span>

      {code ? <span className="absolute bottom-[12.5%] right-[7.5%] max-w-[22%] truncate font-mono text-[8px] font-bold text-slate-400 sm:text-[10px]">{code}</span> : null}
      <div className="absolute bottom-[6.6%] right-[7%] text-right">
        {status ? <p className="mb-1 text-[8px] font-black uppercase tracking-[0.16em] text-emerald-600 sm:text-[9px]">{status}</p> : null}
        <p className="text-[7px] font-bold uppercase tracking-[0.16em] text-slate-400 sm:text-[9px]">Powered by</p>
        <img src={SpsLogo} alt="SPS Corner" className="ml-auto mt-1 h-5 w-auto object-contain sm:h-8" />
      </div>
    </article>
  );
}
