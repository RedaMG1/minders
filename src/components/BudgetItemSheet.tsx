"use client";

import { useState, type FormEvent } from "react";
import { Sheet } from "./Sheet";
import { centsToInput, parseAmount } from "@/lib/money";
import { copyBudgetItemToNextMonth, deleteBudgetItem, newId, saveBudgetItem, showMessage } from "@/lib/store";
import type { BudgetCategory, BudgetItem } from "@/lib/types";

type BudgetItemSheetProps = {
  categoryId: string;
  categoryName: string;
  /** The category the "no subcategory" choice stands for. Defaults to categoryId. */
  parentId?: string;
  /** When set, the item can be put in one of these subcategories. */
  subcategories?: BudgetCategory[];
  item?: BudgetItem;
  /** The date a new item starts with, as YYYY-MM-DD. */
  defaultDate: string;
  onClose: () => void;
};

export function BudgetItemSheet({ categoryId, categoryName, parentId, subcategories = [], item, defaultDate, onClose }: BudgetItemSheetProps) {
  const noneId = parentId ?? categoryId;
  const [placeId, setPlaceId] = useState(categoryId);
  const [label, setLabel] = useState(item?.label ?? "");
  const [amount, setAmount] = useState(item ? centsToInput(item.amount) : "");
  const [date, setDate] = useState(item?.date ?? defaultDate);
  const [error, setError] = useState("");

  /** Saves what's in the sheet. Returns the saved item's id, or null when something needs fixing first. */
  function save(): string | null {
    const cents = parseAmount(amount);
    if (cents === null) {
      setError("Enter the amount as a number, like 12 or 12,50.");
      return null;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      setError("Choose a date.");
      return null;
    }
    const id = item?.id ?? newId();
    saveBudgetItem({
      id,
      categoryId: placeId,
      label: label.trim() || subcategories.find((sub) => sub.id === placeId)?.name || categoryName,
      amount: cents,
      date,
      createdAt: item?.createdAt ?? new Date().toISOString(),
    });
    return id;
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (save()) onClose();
  }

  function remove() {
    if (item) deleteBudgetItem(item.id);
    onClose();
  }

  return (
    <Sheet title={item ? "Edit item" : `Add to ${categoryName}`} onClose={onClose} onSubmit={submit}>
      <label className="field">
        <span>Amount</span>
        <span className="money-field big">
          <input
            className="text-field"
            id="item-amount"
            type="text"
            inputMode="decimal"
            value={amount}
            placeholder="0,00"
            autoFocus={!item}
            onChange={(event) => {
              setAmount(event.target.value);
              setError("");
            }}
          />
          <span aria-hidden="true">€</span>
        </span>
      </label>

      <label className="field">
        <span>What was it? (optional)</span>
        <input
          className="text-field"
          id="item-label"
          type="text"
          value={label}
          placeholder="For example Groceries at Lidl"
          maxLength={80}
          onChange={(event) => setLabel(event.target.value)}
        />
      </label>

      {subcategories.length > 0 && (
        <label className="field">
          <span>Subcategory</span>
          <select className="text-field" id="item-sub" value={placeId} onChange={(event) => setPlaceId(event.target.value)}>
            <option value={noneId}>None, just {categoryName}</option>
            {subcategories.map((sub) => (
              <option key={sub.id} value={sub.id}>
                {sub.name}
              </option>
            ))}
          </select>
        </label>
      )}

      <label className="field">
        <span>Date</span>
        <input
          className="text-field"
          id="item-date"
          type="date"
          value={date}
          onChange={(event) => {
            setDate(event.target.value);
            setError("");
          }}
        />
      </label>

      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}

      <button className="primary" type="submit" disabled={!amount.trim()}>
        {item ? "Save changes" : "Add item"}
      </button>
      {item && (
        <button
          className="ghost"
          type="button"
          onClick={() => {
            // Anything changed in the sheet is saved first, so the copy matches what's on screen.
            const savedId = save();
            if (!savedId) return;
            const copy = copyBudgetItemToNextMonth(savedId);
            if (copy) {
              const [year, month] = copy.date.split("-").map(Number);
              const name = new Date(year, month - 1, 1).toLocaleDateString("en-GB", { month: "long" });
              showMessage(`Copied to ${name}`, copy.label);
            }
            onClose();
          }}
        >
          Copy to next month
        </button>
      )}
      {item && (
        <button className="danger" type="button" onClick={remove}>
          Delete item
        </button>
      )}
    </Sheet>
  );
}
