-- SECURITY DEFINER RPC for bill creation.
-- Bypasses all RLS on bills/bill_shares/bill_items/bill_guest_participants.
-- Does its own auth + participant checks. Runs atomically.

CREATE OR REPLACE FUNCTION public.rpc_create_itemized_bill(
  p_hangout_id  uuid,
  p_payer_id    uuid,
  p_amount_cents     bigint,
  p_subtotal_cents   bigint,
  p_tax_cents        bigint,
  p_tip_cents        bigint,
  p_description text,
  p_paid_at     timestamptz,
  p_shares      jsonb,
  p_items       jsonb
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_uid      uuid;
  v_bill_id  uuid;
  v_guest_id uuid;
  v_share    jsonb;
  v_item     jsonb;
  v_pos      int := 0;
BEGIN
  v_uid := auth.uid();

  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;

  -- Authorization: must be a participant or host of the hangout (for hangout bills)
  IF p_hangout_id IS NOT NULL THEN
    IF NOT (
      EXISTS (
        SELECT 1 FROM public.hangout_participants
        WHERE hangout_id = p_hangout_id
          AND user_id    = v_uid
          AND status IN ('invited', 'accepted', 'maybe', 'declined')
      )
      OR EXISTS (
        SELECT 1 FROM public.hangouts
        WHERE id = p_hangout_id AND host_id = v_uid
      )
    ) THEN
      RAISE EXCEPTION 'Not a participant of this hangout' USING ERRCODE = '42501';
    END IF;
  END IF;

  -- Insert bill
  INSERT INTO public.bills (
    hangout_id, payer_id, mode,
    amount_cents, subtotal_cents, tax_cents, tip_cents,
    currency, description, paid_at, created_by
  ) VALUES (
    p_hangout_id, p_payer_id, 'itemized',
    p_amount_cents, p_subtotal_cents, p_tax_cents, p_tip_cents,
    'USD', p_description, p_paid_at, v_uid
  ) RETURNING id INTO v_bill_id;

  -- Insert shares (and guest participants inline)
  FOR v_share IN SELECT * FROM jsonb_array_elements(p_shares) LOOP
    IF (v_share->>'guest_name') IS NOT NULL THEN
      INSERT INTO public.bill_guest_participants (bill_id, name)
      VALUES (v_bill_id, v_share->>'guest_name')
      RETURNING id INTO v_guest_id;

      INSERT INTO public.bill_shares (bill_id, guest_participant_id, amount_cents, split_method)
      VALUES (v_bill_id, v_guest_id, (v_share->>'amount_cents')::bigint, 'exact');
    ELSE
      INSERT INTO public.bill_shares (bill_id, user_id, amount_cents, split_method)
      VALUES (v_bill_id, (v_share->>'user_id')::uuid, (v_share->>'amount_cents')::bigint, 'exact');
    END IF;
  END LOOP;

  -- Insert items
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    INSERT INTO public.bill_items (bill_id, description, amount_cents, quantity, source, position)
    VALUES (
      v_bill_id,
      v_item->>'description',
      (v_item->>'amount_cents')::bigint,
      COALESCE((v_item->>'quantity')::int, 1),
      COALESCE(v_item->>'source', 'manual'),
      COALESCE((v_item->>'position')::int, v_pos)
    );
    v_pos := v_pos + 1;
  END LOOP;

  RETURN v_bill_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_create_itemized_bill TO authenticated;
