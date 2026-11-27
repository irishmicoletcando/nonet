import Link from "next/link";
import type { ButtonHTMLAttributes, ComponentProps } from "react";

export type ButtonVariant = "primary" | "secondary";

function classes(variant: ButtonVariant, small: boolean | undefined, extra?: string) {
  return ["btn", `btn-${variant}`, small ? "btn-small" : "", extra ?? ""].filter(Boolean).join(" ");
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  small?: boolean;
}

export function Button({ variant = "secondary", small, className, type = "button", ...rest }: ButtonProps) {
  return <button type={type} className={classes(variant, small, className)} {...rest} />;
}

type ButtonLinkProps = ComponentProps<typeof Link> & {
  variant?: ButtonVariant;
  small?: boolean;
};

export function ButtonLink({ variant = "secondary", small, className, ...rest }: ButtonLinkProps) {
  return <Link className={classes(variant, small, className)} {...rest} />;
}
