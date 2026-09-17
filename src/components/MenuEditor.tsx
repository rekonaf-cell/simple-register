"use client";

import { useState } from "react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { CATEGORIES, type Category, type MenuItem } from "@/lib/types";
import { addMenuItem, deleteMenuItem, reorderMenuItems, updateMenuItem, useMenu } from "@/lib/useMenu";

function SortableMenuRow({
  item,
  onUpdate,
  onRemove,
}: {
  item: MenuItem;
  onUpdate: (id: string, patch: Partial<Omit<MenuItem, "id">>) => void;
  onRemove: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <li
      ref={setNodeRef}
      style={style}
      className="flex flex-wrap items-center gap-2 bg-white px-3 py-2"
    >
      <button
        {...attributes}
        {...listeners}
        className="touch-none px-1 text-lg text-zinc-400"
        aria-label="並び替え"
      >
        ⠿
      </button>
      <input
        type="text"
        value={item.name}
        onChange={(e) => onUpdate(item.id, { name: e.target.value })}
        className="min-w-0 flex-1 rounded-lg border border-transparent px-2 py-1 text-sm focus:border-zinc-300"
      />
      <select
        value={item.category}
        onChange={(e) => onUpdate(item.id, { category: e.target.value as Category })}
        className="rounded-lg border border-transparent px-2 py-1 text-sm focus:border-zinc-300"
      >
        {CATEGORIES.map((cat) => (
          <option key={cat} value={cat}>
            {cat}
          </option>
        ))}
      </select>
      <input
        type="number"
        inputMode="numeric"
        value={item.price}
        onChange={(e) => onUpdate(item.id, { price: Number(e.target.value) || 0 })}
        min={0}
        className="w-20 rounded-lg border border-transparent px-2 py-1 text-right text-sm focus:border-zinc-300"
      />
      <button onClick={() => onRemove(item.id)} className="text-xs text-red-500">
        削除
      </button>
    </li>
  );
}

export default function MenuEditor() {
  const { menu, loading } = useMenu();
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [category, setCategory] = useState<Category>(CATEGORIES[0]);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } })
  );

  function addItem(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    const priceNum = Number(price);
    if (!trimmed || !Number.isFinite(priceNum) || priceNum < 0) return;
    const categoryItems = menu.filter((item) => item.category === category);
    const nextSortOrder =
      categoryItems.length > 0 ? Math.max(...categoryItems.map((item) => item.sort_order)) + 1 : 0;
    addMenuItem({ name: trimmed, price: priceNum, category, sort_order: nextSortOrder });
    setName("");
    setPrice("");
  }

  function updateItem(id: string, patch: Partial<Omit<MenuItem, "id">>) {
    updateMenuItem(id, patch);
  }

  function removeItem(id: string) {
    if (!window.confirm("このメニューを削除しますか？")) return;
    deleteMenuItem(id);
  }

  function handleDragEnd(categoryItems: MenuItem[], event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = categoryItems.findIndex((item) => item.id === active.id);
    const newIndex = categoryItems.findIndex((item) => item.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const reordered = arrayMove(categoryItems, oldIndex, newIndex);
    reorderMenuItems(reordered.map((item) => item.id));
  }

  if (loading) {
    return <p className="p-4 text-sm text-zinc-500">読み込み中...</p>;
  }

  return (
    <div className="flex flex-1 flex-col gap-4 p-4">
      <form onSubmit={addItem} className="flex flex-col gap-2 rounded-xl bg-white p-3 shadow sm:flex-row">
        <input
          type="text"
          placeholder="商品名"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="flex-1 rounded-lg border border-zinc-300 px-3 py-2 text-sm"
        />
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value as Category)}
          className="rounded-lg border border-zinc-300 px-3 py-2 text-sm"
        >
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <input
          type="number"
          inputMode="numeric"
          placeholder="価格"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          min={0}
          className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm sm:w-28"
        />
        <button
          type="submit"
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white active:bg-zinc-700"
        >
          追加
        </button>
      </form>

      {menu.length === 0 ? (
        <p className="rounded-lg border border-dashed border-zinc-300 p-4 text-center text-sm text-zinc-500">
          メニューがありません。上のフォームから追加してください。
        </p>
      ) : (
        CATEGORIES.map((c) => {
          const items = menu.filter((item) => item.category === c);
          if (items.length === 0) return null;
          const ids = items.map((item) => item.id);
          return (
            <section key={c}>
              <h2 className="mb-2 text-sm font-semibold text-zinc-500">{c}</h2>
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={(event) => handleDragEnd(items, event)}
              >
                <SortableContext items={ids} strategy={verticalListSortingStrategy}>
                  <ul className="divide-y divide-zinc-200 rounded-xl bg-white shadow">
                    {items.map((item) => (
                      <SortableMenuRow key={item.id} item={item} onUpdate={updateItem} onRemove={removeItem} />
                    ))}
                  </ul>
                </SortableContext>
              </DndContext>
            </section>
          );
        })
      )}
    </div>
  );
}
