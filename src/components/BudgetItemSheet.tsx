"use client";

import { useState, type FormEvent } from "react";
import { Sheet } from "./Sheet";
import { centsToInput, parseAmount } from "@/lib/money";
import { deleteBudgetItem, newId, saveBudgetItem } from "@/lib/store";
import type { BudgetItem } from "@/lib/types";

type BudgetItemSheetProps = {
  categoryId: string;
  categoryName: string;
  item?: BudgetItem;
  /** The date a new item starts with, as YYYY-MM-DD. */
  defaultDate: string;
  onClose: () => void;
};

export function BudgetItemSheet({ categoryId, categoryName, item, defaultDate, onClose }: BudgetItemSheetProps) {
  const [label, setLabel] = useState(item?.label ?? "");
  const [amount, setAmount] = useState(item ? centsToInput(item.amount) : "");
  const [date, setDate] = useState(item?.date ?? defaultDate);
  const [error, setError] = useState("");

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cents = parseAmount(amount);
    if (cents === null) {
      setError("Enter the amount as a number, like 12 or 12,50.");
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      setError("Choose a date.");
      return;
    }
    saveBudgetItem({
      id: item?.id ?? newId(),
      categoryId,
      label: label.trim() || categoryName,
      amount: cents,
      date,
      createdAt: item?.createdAt ?? new Date().toISOString(),
    });
    onClose();
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
        <button className="danger" type="button" onClick={remove}>
          Delete item
        </button>
      )}
    </Sheet>
  );
}
