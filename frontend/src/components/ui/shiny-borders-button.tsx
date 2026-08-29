const RealismButton = ({
  text,
  type = "button",
  disabled = false,
  onClick,
}: {
  text: string;
  type?: "submit" | "button";
  disabled?: boolean;
  onClick?: () => void;
}) => {
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={`group relative p-[1px] rounded-[11px] text-[0.9rem] border-none cursor-pointer bg-[radial-gradient(circle_80px_at_80%_-10%,_#c9c9c9,_#141616)] transition-all ${
        disabled ? "opacity-50 pointer-events-none" : ""
      }`}
    >
      {/* Glow behind button */}
      <div className="absolute top-0 right-0 w-[65%] h-[60%] rounded-[120px] shadow-[0_0_20px_#ffffff38] group-hover:shadow-[0_0_40px_#ffffff60] transition-all duration-300 ease-out -z-10" />

      {/* Bottom-left purple blob */}
      <div className="absolute bottom-0 left-0 w-[30px] h-[50%] rounded-[14px] transition-all duration-300 ease-out
        bg-[radial-gradient(circle_60px_at_0%_100%,_#a855f7,_#a855f750,_transparent)]
        shadow-[-2px_9px_40px_#7c3aed40]
        group-hover:w-[46px] group-hover:shadow-[-4px_1px_45px_#7c3aed60]" />

      {/* Inner content */}
      <div className="relative px-[14px] py-[8px] group-hover:scale-105 rounded-[9px] text-white bg-[radial-gradient(circle_80px_at_80%_-50%,_#454545,_#0b0d0d)] z-10 transition-all duration-300">
        {text}

        {/* Inner glow layer */}
        <div className="absolute inset-0 rounded-[14px] bg-[radial-gradient(circle_60px_at_0%_100%,_#00e1ff1a,_#0000ff11,_transparent)] z-[-1]" />
      </div>
    </button>
  );
};

export default RealismButton;
