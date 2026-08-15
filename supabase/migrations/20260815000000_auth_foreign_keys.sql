-- Auth-related foreign keys (Module: identity FK wiring)
-- Links profile/ownership columns to auth.users and profile tables
-- with the approved ON DELETE behaviors.

-- auth.users references
alter table public.profiles_buyer
  add constraint profiles_buyer_id_fkey
  foreign key (id) references auth.users(id) on delete cascade;

alter table public.profiles_seller
  add constraint profiles_seller_id_fkey
  foreign key (id) references auth.users(id) on delete cascade;

alter table public.addresses
  add constraint addresses_user_id_fkey
  foreign key (user_id) references auth.users(id) on delete cascade;

alter table public.notifications
  add constraint notifications_user_id_fkey
  foreign key (user_id) references auth.users(id) on delete cascade;

alter table public.messages
  add constraint messages_sender_id_fkey
  foreign key (sender_id) references auth.users(id) on delete restrict;

alter table public.messages
  add constraint messages_recipient_id_fkey
  foreign key (recipient_id) references auth.users(id) on delete restrict;

alter table public.admin_audit_logs
  add constraint admin_audit_logs_admin_id_fkey
  foreign key (admin_id) references auth.users(id) on delete restrict;

-- profiles_seller references
alter table public.kyc_documents
  add constraint kyc_documents_seller_id_fkey
  foreign key (seller_id) references public.profiles_seller(id) on delete cascade;

alter table public.kyc_verification_requests
  add constraint kyc_verification_requests_seller_id_fkey
  foreign key (seller_id) references public.profiles_seller(id) on delete cascade;

alter table public.products
  add constraint products_seller_id_fkey
  foreign key (seller_id) references public.profiles_seller(id) on delete set null;

alter table public.orders
  add constraint orders_seller_id_fkey
  foreign key (seller_id) references public.profiles_seller(id) on delete restrict;

alter table public.escrow_transactions
  add constraint escrow_transactions_seller_id_fkey
  foreign key (seller_id) references public.profiles_seller(id) on delete restrict;

-- profiles_buyer references
alter table public.orders
  add constraint orders_buyer_id_fkey
  foreign key (buyer_id) references public.profiles_buyer(id) on delete restrict;

alter table public.reviews
  add constraint reviews_buyer_id_fkey
  foreign key (buyer_id) references public.profiles_buyer(id) on delete restrict;
