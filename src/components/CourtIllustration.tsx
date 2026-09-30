export default function CourtIllustration() {
  return (
    <div className="hero-court" aria-hidden="true">
      <svg viewBox="0 0 400 280" fill="none">
        <defs>
          <linearGradient id="court-fill" x1="45" y1="64" x2="335" y2="196" gradientUnits="userSpaceOnUse"><stop stopColor="#C6FF3D" stopOpacity=".12" /><stop offset="1" stopColor="#C6FF3D" stopOpacity=".025" /></linearGradient>
        </defs>
        <g className="court-lines" transform="rotate(-12 200 140)">
          {/* A badminton court is 13.4 m long and 6.1 m wide. */}
          <rect x="45" y="64" width="290" height="132" fill="url(#court-fill)" stroke="#C6FF3D" strokeOpacity=".55" strokeWidth="1.5" />
          {/* Singles sidelines, doubles back service lines, and short service lines. */}
          <path d="M45 74h290M45 186h290M61 64v132M319 64v132M147 64v132M233 64v132M45 130h102M233 130h102" stroke="#C6FF3D" strokeOpacity=".35" />
          <path d="M190 56v148" stroke="#C6FF3D" strokeWidth="2" />
          <circle cx="110" cy="145" r="6" fill="#C6FF3D" />
          <circle cx="273" cy="111" r="6" fill="#F3F6FF" fillOpacity=".9" />
          <path d="M118 139Q196 69 266 105" stroke="#C6FF3D" strokeDasharray="3 6" strokeOpacity=".55" strokeLinecap="round" />
        </g>
        <g className="court-shuttle" transform="translate(300 43) rotate(24)">
          <path d="M-20-22Q0-28 20-22L7 7H-7L-20-22Z" fill="#F3F6FF" fillOpacity=".94" stroke="#F3F6FF" strokeWidth="1.5" strokeLinejoin="round" />
          <path d="M-13-23-5 6M-6-25-2 6M0-25V6M6-25 2 6M13-23 5 6" stroke="#8390AA" strokeOpacity=".65" strokeWidth="1" />
          <path d="M-7 7H7V11a7 7 0 0 1-14 0V7Z" fill="#C6FF3D" />
        </g>
      </svg>
      <div className="hero-court-label"><span className="inline-block w-1.5 h-1.5 rounded-full bg-[#C6FF3D]" /> YOUR NEXT LEVEL STARTS HERE</div>
    </div>
  );
}
