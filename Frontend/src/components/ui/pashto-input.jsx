/**
 * PashtoInput – pure JSX, no TypeScript
 * Accepts Pashto (Eastern-Arabic) and ASCII numerals.
 * Converts Pashto numerals on change so downstream logic receives ASCII digits.
 */
import { forwardRef } from "react";
import { Input } from "./input.jsx";
import { parsePashtoNum } from "@/components/context/i18n";

const PashtoInput = forwardRef(function PashtoInput(
  { onChange, ...props },
  ref,
) {
  const handleChange = (e) => {
    const raw = e.target.value;
    const converted = parsePashtoNum(raw);
    if (converted !== raw) {
      Object.defineProperty(e.target, "value", {
        writable: true,
        value: converted,
      });
    }
    onChange?.(e);
  };

  return (
    <Input ref={ref} inputMode="decimal" onChange={handleChange} {...props} />
  );
});

export default PashtoInput;
