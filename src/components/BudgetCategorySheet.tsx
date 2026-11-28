"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Sheet } from "./Sheet";
import { centsToInput, parseAmount } from "@/lib/money";
import { MODULE_COLORS } from "@/lib/options";
import { deleteBudgetCategory, newId, saveBudgetCategory } from "@/lib/store";
import type { BudgetCategory } from "@/lib/types";

type BudgetCategorySheetProps = {
  category?: BudgetCategory;
  /** How many items would be deleted along with this category. */
  itemCount?: number;
  /** How many subcategories would be deleted along with this category. */
  subCount?: number;
  /** Set when creating a subcategory inside this category. */
  parent?: BudgetCategory;
  onClose: () => void;
};

export function BudgetCategorySheet({ category, itemCount = 0, subCount = 0, parent, onClose }: BudgetCategorySheetProps) {
  const parentId = category?.parentId ?? parent?.id;
  const kind = parentId ? "subcategory" : "category";
  const router = useRouter();
  const [name, setName] = useState(category?.name ?? "");
  const [color, setColor] = useState(category?.color ?? parent?.color ?? MODULE_COLORS[0].value);
  const [limit, setLimit] = useState(category?.monthlyLimit ? centsToInput(category.monthlyLimit) : "");
  const [error, setError] = useState("");
  const [savings, setSavings] = useState(Boolean(category?.savings));
  const [confirming, setConfirming] = useState(false);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    const monthlyLimit = limit.trim() ? parseAmount(limit) : undefined;
    if (monthlyLimit === null) {
      setError("Enter the limit as an amount, like 300 or 249,90.");
      return;
    }
    saveBudgetCategory({
      id: category?.id ?? newId(),
      name: trimmed,
      color,
      monthlyLimit,
      ...(parentId ? { parentId } : {}),
      ...(!parentId && savings ? { savings: true } : {}),
      createdAt: category?.createdAt ?? new Date().toISOString(),
    });
    onClose();
  }

  function remove() {
    if (!category) return;
    deleteBudgetCategory(category.id);
    router.push(parentId ? `/budget/category?id=${parentId}` : "/budget");
  }

  return (
    <Sheet title={`${category ? "Edit" : "New"} ${kind}`} onClose={onClose} onSubmit={submit}>
      <label className="field">
        <span>Name</span>
        <input
          className="text-field"
          id="category-name"
          type="text"
          value={name}
          placeholder={parentId ? "For example Groceries or Restaurants" : "For example Food, Car or Rent"}
          maxLength={40}
          onChange={(event) => setName(event.target.value)}
        />
      </label>

      <label className="field">
        <span>Monthly limit (optional)</span>
        <span className="money-field">
          <input
            className="text-field"
            id="category-limit"
            type="text"
            inputMode="decimal"
            value={limit}
            placeholder="300"
            onChange={(event) => {
              setLimit(event.target.value);
              setError("");
            }}
          />
          <span aria-hidden="true">€</span>
        </span>
      </label>

      {!parentId && (
        <label className="setting share-setting">
          <span>
            <b>This is savings</b>
            <small>Money here is kept apart: it never counts as spent, in your plan or in the stats.</small>
          </span>
          <input className="switch" type="checkbox" id="category-savings" checked={savings} onChange={(event) => setSavings(event.target.checked)} />
        </label>
      )}

      <fieldset className="field">
        <legend>Color</legend>
        <div className="pick-row">
          {MODULE_COLORS.map((option) => (
            <span key={option.value}>
              <input
                className="chip-input"
                type="radio"
                name="category-color"
                id={`category-color-${option.value}`}
                checked={color === option.value}
                onChange={() => setColor(option.value)}
              />
              <label
                className={`swatch t-${option.value}`}
                style={{ display: "block" }}
                htmlFor={`category-color-${option.value}`}
                aria-label={option.label}
              />
            </span>
          ))}
        </div>
      </fieldset>

      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}

      <button className="primary" type="submit" disabled={!name.trim()}>
        {category ? "Save changes" : `Create ${kind}`}
      </button>

      {category &&
        (confirming ? (
          <div className="confirm">
            <p>
              Delete {category.name}
              {subCount > 0 && `, its ${subCount} ${subCount === 1 ? "subcategory" : "subcategories"}`}
              {itemCount > 0 && ` and its ${itemCount} ${itemCount === 1 ? "item" : "items"} from every month`}? You can&apos;t
              undo this.
            </p>
            <button className="danger solid" type="button" onClick={remove}>
              Delete {kind}
            </button>
            <button className="ghost" type="button" onClick={() => setConfirming(false)}>
              Keep {kind}
            </button>
          </div>
        ) : (
          <button className="danger" type="button" onClick={() => setConfirming(true)}>
            Delete {kind}
          </button>
        ))}
    </Sheet>
  );
}
