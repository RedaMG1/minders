"use client";

import Link from "next/link";
import { Icon } from "@/components/Icon";
import { TabBar } from "@/components/TabBar";
import { PALETTE, THEMES } from "@/lib/options";
import { setBrand, setTheme, useApp } from "@/lib/store";

export default function ThemePage() {
  const app = useApp();
  if (!app) return <div className="screen" />;

  const { brand, theme } = app.state;

  return (
    <div className="screen">
      <div className="status" />
      <div className="editor-bar">
        <Link className="back" href="/">
          <Icon name="back" />
          Home
        </Link>
      </div>
      <div className="page-head">
        <h1 className="day-title">Theme</h1>
      </div>
      <div className="scroll color-body">
        <fieldset className="field">
          <legend>Choose a look</legend>
          <div className="theme-list">
            {THEMES.map((option) => (
              <div key={option.value}>
                <input
                  className="chip-input"
                  type="radio"
                  name="theme"
                  id={`theme-${option.value}`}
                  checked={theme === option.value}
                  onChange={() => setTheme(option.value)}
                />
                <label className="theme-card" htmlFor={`theme-${option.value}`}>
                  <span className="theme-mini" style={{ background: option.preview.page }} aria-hidden="true">
                    <i style={{ background: option.value === "custom" ? brand : option.preview.accent }} />
                    <span>
                      {option.preview.cards.map((color, index) => (
                        <i key={index} style={{ background: color }} />
                      ))}
                    </span>
                  </span>
                  <span>
                    <b>{option.label}</b>
                    <small>{option.description}</small>
                  </span>
                  {theme === option.value && <Icon name="check" />}
                </label>
              </div>
            ))}
          </div>
        </fieldset>

        {theme === "custom" && (
          <>
            <fieldset className="field">
              <legend>Palette</legend>
              <div className="color-grid">
                {PALETTE.map((color) => (
                  <span key={color.value}>
                    <input
                      className="chip-input"
                      type="radio"
                      name="app-color"
                      id={`palette-${color.value.slice(1)}`}
                      checked={brand === color.value}
                      onChange={() => setBrand(color.value)}
                    />
                    <label
                      className="color-dot"
                      style={{ "--dot": color.value, display: "block" } as React.CSSProperties}
                      htmlFor={`palette-${color.value.slice(1)}`}
                      aria-label={color.label}
                    />
                  </span>
                ))}
              </div>
            </fieldset>

            <div className="field">
              <span>Any color</span>
              <label className="custom-color">
                <input
                  id="custom-color"
                  type="color"
                  value={brand}
                  aria-label="Choose any color"
                  onChange={(event) => setBrand(event.target.value)}
                />
                <span>
                  <b>Choose your own</b>
                  <small>{brand.toUpperCase()}</small>
                </span>
              </label>
            </div>
          </>
        )}
      </div>
      <TabBar />
    </div>
  );
}
