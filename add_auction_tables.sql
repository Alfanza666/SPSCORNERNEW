-- Table: auction_items
CREATE TABLE IF NOT EXISTS public.auction_items (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name text NOT NULL,
  description text,
  image_url text,
  stock integer NOT NULL DEFAULT 1 CHECK (stock >= 0),
  start_time timestamptz NOT NULL,
  end_time timestamptz NOT NULL,
  allowed_roles text[] DEFAULT ARRAY['Operator', 'Admin']::text[],
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.auction_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view auction items" ON public.auction_items FOR SELECT USING (true);

-- Table: auction_claims
CREATE TABLE IF NOT EXISTS public.auction_claims (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  auction_item_id uuid NOT NULL REFERENCES public.auction_items(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  claimed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(auction_item_id, user_id)
);

ALTER TABLE public.auction_claims ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own claims" ON public.auction_claims FOR SELECT USING (auth.uid() = user_id);

-- RPC: claim_auction_item
CREATE OR REPLACE FUNCTION public.claim_auction_item(p_item_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_item record;
  v_user_role text;
  v_already_claimed boolean;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT role INTO v_user_role FROM public.profiles WHERE id = auth.uid();

  -- Lock the row for update (Concurrency Control)
  SELECT * INTO v_item
  FROM public.auction_items
  WHERE id = p_item_id
  FOR UPDATE;

  IF v_item IS NULL THEN
    RAISE EXCEPTION 'Item tidak ditemukan.';
  END IF;

  IF now() < v_item.start_time THEN
    RAISE EXCEPTION 'Lelang belum dimulai.';
  END IF;
  IF now() > v_item.end_time THEN
    RAISE EXCEPTION 'Lelang sudah berakhir.';
  END IF;

  -- Optional: check roles if required
  -- IF NOT (v_user_role = ANY(v_item.allowed_roles)) THEN
  --   RAISE EXCEPTION 'Role Anda tidak diizinkan mengikuti lelang ini.';
  -- END IF;

  SELECT EXISTS(
    SELECT 1 FROM public.auction_claims
    WHERE auction_item_id = p_item_id AND user_id = auth.uid()
  ) INTO v_already_claimed;

  IF v_already_claimed THEN
    RAISE EXCEPTION 'Anda sudah mengklaim item ini.';
  END IF;

  IF v_item.stock <= 0 THEN
    RAISE EXCEPTION 'Item sudah habis.';
  END IF;

  UPDATE public.auction_items
  SET stock = stock - 1
  WHERE id = p_item_id;

  INSERT INTO public.auction_claims (auction_item_id, user_id)
  VALUES (p_item_id, auth.uid());

  RETURN json_build_object('success', true, 'message', 'Berhasil mengklaim aset!');
END;
$$;
