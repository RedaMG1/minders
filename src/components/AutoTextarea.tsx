"use client";

import { useLayoutEffect, useRef, type TextareaHTMLAttributes } from "react";

/** A text box that grows with its text, so nothing long is ever cut off. */
export function AutoTextarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useLayoutEffect(() => {
    const box = ref.current;
    if (!box) return;
    const fit = () => {
      box.style.height = "auto";
      box.style.height = `${box.scrollHeight}px`;
    };
    fit();
    // Turning the phone changes the width, and with it how many lines the text needs.
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, [props.value]);

  return <textarea ref={ref} rows={1} {...props} />;
}
