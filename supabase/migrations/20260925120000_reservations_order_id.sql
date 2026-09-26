-- 予約台帳行を配車依頼へ紐付ける。削除時は台帳を残す。
ALTER TABLE public.reservations
  ADD COLUMN IF NOT EXISTS order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS reservations_order_id_idx
  ON public.reservations (order_id)
  WHERE order_id IS NOT NULL;
