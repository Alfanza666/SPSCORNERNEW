import QRCode from 'react-qr-code';
import FederasiLogo from '../ui/federasi-logo.png';
import FrameBackground from '../ui/Frame QR New.png';
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
  const participantType = (beneficiaryLabel || 'Peserta').toUpperCase();
  const eventName = (programName || 'PROGRAM SERIKAT').toUpperCase();
  const ticketType = (ticketTitle || 'TIKET').toUpperCase();
  const statusLabel = (status || '-').toUpperCase();

  return (
    <article className={`relative mx-auto aspect-[3/4] w-full max-w-[30rem] overflow-hidden rounded-[1.25rem] bg-white text-slate-950 shadow-2xl sm:rounded-[1.75rem] ${className}`}>
      <img src={FrameBackground} alt="" aria-hidden="true" className="absolute inset-0 z-0 h-full w-full object-contain" />

      <img src={SariRotiLogo} alt="Sari Roti Group" className="absolute left-[6%] top-[4.5%] z-10 max-h-[6%] w-[14.5%] object-contain" />
      <img src={FederasiLogo} alt="Federasi SPS" className="absolute right-[6%] top-[4.5%] z-10 max-h-[6.2%] w-[10.5%] object-contain" />

      <section className="absolute left-[19%] right-[19%] top-[7.4%] z-10 text-center">
        <p
          className="mx-auto max-w-[30%] truncate rounded-full bg-blue-900 px-[3%] py-[0.9%] font-black uppercase tracking-[0.12em] text-white shadow-sm"
          style={{ fontSize: 'clamp(0.38rem, 1.35vw, 0.7rem)' }}
        >
          {participantType}
        </p>
        <h2
          className="mx-auto mt-[1.5%] line-clamp-2 max-w-full font-black uppercase leading-[0.98] text-blue-900 drop-shadow-[0_1px_0_rgba(255,255,255,0.85)]"
          style={{ fontSize: 'clamp(0.78rem, 3.2vw, 1.65rem)' }}
        >
          {eventName}
        </h2>
        <p
          className="mx-auto mt-[1.2%] max-w-[70%] truncate font-black uppercase tracking-[0.14em] text-slate-800"
          style={{ fontSize: 'clamp(0.48rem, 1.65vw, 0.82rem)' }}
        >
          {ticketType}
        </p>
      </section>

      <div className="absolute left-[27%] top-[30.5%] z-20 flex aspect-square w-[46%] items-center justify-center rounded-[12px] bg-white p-[2.5%] shadow-[0_16px_45px_-28px_rgba(30,64,175,0.9)]">
        <QRCode value={qrValue} size={240} bgColor="#ffffff" fgColor="#0f172a" level="H" style={{ width: '100%', height: '100%' }} />
      </div>

      <div className="absolute left-[8%] top-[73.8%] z-30 w-[51%]">
        <p className="font-black uppercase tracking-[0.18em] text-blue-900/75" style={{ fontSize: 'clamp(0.36rem, 1.2vw, 0.58rem)' }}>Nama</p>
        <p className="mt-[0.8%] truncate font-black uppercase leading-tight text-blue-950" style={{ fontSize: 'clamp(0.62rem, 2vw, 1rem)' }}>{name || '-'}</p>
      </div>

      <div className="absolute left-[8%] top-[81.1%] z-30 w-[51%]">
        <p className="font-black uppercase tracking-[0.18em] text-blue-900/75" style={{ fontSize: 'clamp(0.36rem, 1.2vw, 0.58rem)' }}>NIK</p>
        <p className="mt-[0.8%] truncate font-mono font-black leading-tight text-blue-950" style={{ fontSize: 'clamp(0.56rem, 1.75vw, 0.86rem)' }}>{nik || '-'}</p>
      </div>

      {code ? (
        <p className="absolute left-[8%] top-[86.2%] z-30 w-[48%] truncate font-mono font-bold uppercase tracking-[0.02em] text-blue-900/65" style={{ fontSize: 'clamp(0.42rem, 1.35vw, 0.68rem)' }}>
          {code}
        </p>
      ) : null}

      <div className="absolute left-[68%] top-[74.5%] z-40 w-[24%] text-center">
        <p
          className={`mx-auto inline-flex max-w-full items-center justify-center rounded-full px-[8%] py-[3%] font-black uppercase tracking-[0.08em] shadow-sm ${
            statusLabel === 'AKTIF'
              ? 'bg-emerald-500 text-white'
              : statusLabel === 'SUDAH DIGUNAKAN'
                ? 'bg-amber-500 text-white'
                : 'bg-slate-200 text-slate-700'
          }`}
          style={{ fontSize: 'clamp(0.42rem, 1.35vw, 0.68rem)' }}
        >
          {statusLabel}
        </p>
        <p className="mt-[12%] font-bold uppercase tracking-[0.12em] text-slate-400" style={{ fontSize: 'clamp(0.34rem, 1.05vw, 0.52rem)' }}>Powered by</p>
        <img src={SpsLogo} alt="SPS Corner" className="mx-auto mt-[4%] w-full max-w-[96%] object-contain" />
      </div>
    </article>
  );
}
