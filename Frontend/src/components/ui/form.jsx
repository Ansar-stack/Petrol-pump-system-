/**
 * Form helpers – pure JSX wrappers for react-hook-form
 * No Radix UI, no TypeScript.
 *
 * Usage:
 *   <Form {...form}>
 *     <form onSubmit={form.handleSubmit(onSubmit)}>
 *       <FormField control={form.control} name="email" render={({ field }) => (
 *         <FormItem>
 *           <FormLabel>Email</FormLabel>
 *           <FormControl><Input {...field} /></FormControl>
 *           <FormMessage />
 *         </FormItem>
 *       )} />
 *     </form>
 *   </Form>
 */
import { createContext, useContext } from "react";
import { useFormContext, FormProvider, useController } from "react-hook-form";

// ── Form (wraps FormProvider) ────────────────────────────────────────────────
export function Form({ children, ...methods }) {
  return <FormProvider {...methods}>{children}</FormProvider>;
}

// ── FormField ────────────────────────────────────────────────────────────────
const FieldCtx = createContext(null);

export function FormField({ control, name, render }) {
  const { field, fieldState } = useController({ control, name });
  return (
    <FieldCtx.Provider value={{ field, fieldState, name }}>
      {render({ field, fieldState })}
    </FieldCtx.Provider>
  );
}

// ── FormItem ─────────────────────────────────────────────────────────────────
export function FormItem({ className = "", children, ...props }) {
  return (
    <div className={["flex flex-col gap-1.5", className].join(" ")} {...props}>
      {children}
    </div>
  );
}

// ── FormLabel ────────────────────────────────────────────────────────────────
export function FormLabel({ className = "", children, ...props }) {
  const ctx = useContext(FieldCtx);
  const hasError = !!ctx?.fieldState?.error;
  return (
    <label
      className={[
        "text-sm font-normal leading-none",
        hasError ? "text-destructive" : "text-foreground",
        className,
      ].join(" ")}
      {...props}
    >
      {children}
    </label>
  );
}

// ── FormControl ───────────────────────────────────────────────────────────────
export function FormControl({ children }) {
  return <>{children}</>;
}

// ── FormDescription ───────────────────────────────────────────────────────────
export function FormDescription({ className = "", children, ...props }) {
  return (
    <p
      className={["text-xs text-muted-foreground", className].join(" ")}
      {...props}
    >
      {children}
    </p>
  );
}

// ── FormMessage ───────────────────────────────────────────────────────────────
export function FormMessage({ className = "", children, ...props }) {
  const ctx = useContext(FieldCtx);
  const methods = useFormContext();
  const name = ctx?.name;
  const error = name
    ? methods?.formState?.errors?.[name]
    : ctx?.fieldState?.error;
  const message = error?.message ?? children;
  if (!message) return null;
  return (
    <p
      className={["text-xs font-medium text-destructive", className].join(" ")}
      {...props}
    >
      {message}
    </p>
  );
}
