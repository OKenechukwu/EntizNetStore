-- EntizNetStore canonical seed snapshot
-- Captured from the live Supabase project kllwwurklumhawfsilpd on 2026-08-21
-- before M0 production-foundation database changes.
--
-- Scope: the complete current application data set. At capture time there were
-- zero auth users, zero storage objects, zero products/orders/messages/etc.;
-- only the 6 brands and 16 categories below existed.

begin;

insert into public.brands
  (id, name, slug, website, logo_url, metadata, banner_url, created_at, updated_at, description, is_verified)
values
  ('cd7af391-1715-4a05-819b-6398fd91d2a1','Discreet Desires','discreet-desires',null,null,'{}'::jsonb,null,'2025-09-23T16:46:46.228688+00:00','2025-09-23T16:46:46.228688+00:00','Elegant and sophisticated pleasure products',true),
  ('f1d4edff-ef69-4a16-b12e-4b3ba540479d','Golden Touch','golden-touch',null,null,'{}'::jsonb,null,'2025-09-23T16:46:46.228688+00:00','2025-09-23T16:46:46.228688+00:00','High-end luxury intimate experiences',true),
  ('6a21d3c4-03c0-4499-8a6a-674c6efebf36','Luxe Intimates','luxe-intimates',null,null,'{}'::jsonb,null,'2025-09-23T16:46:46.228688+00:00','2025-09-23T16:46:46.228688+00:00','Premium designer intimate products',true),
  ('3b4a3346-bf92-4ebc-86a8-a1e3d4aa0a09','Midnight Collection','midnight-collection',null,null,'{}'::jsonb,null,'2025-09-23T16:46:46.228688+00:00','2025-09-23T16:46:46.228688+00:00','Exclusive after-dark essentials',false),
  ('f1c45cb4-911b-44ec-a6dd-3afc9e3eb76a','Silken Dreams','silken-dreams',null,null,'{}'::jsonb,null,'2025-09-23T16:46:46.228688+00:00','2025-09-23T16:46:46.228688+00:00','Premium silk and satin intimate wear',true),
  ('eea6b5b6-221a-4c08-b604-af3e6b80723d','Velvet Touch','velvet-touch',null,null,'{}'::jsonb,null,'2025-09-23T16:46:46.228688+00:00','2025-09-23T16:46:46.228688+00:00','Soft luxury adult accessories',true)
on conflict (id) do update set
  name=excluded.name, slug=excluded.slug, website=excluded.website,
  logo_url=excluded.logo_url, metadata=excluded.metadata,
  banner_url=excluded.banner_url, created_at=excluded.created_at,
  updated_at=excluded.updated_at, description=excluded.description,
  is_verified=excluded.is_verified;

-- Root categories first so the self-referencing FK is always satisfied.
insert into public.categories
  (id, name, slug, is_adult, metadata, image_url, is_active, parent_id, created_at, sort_order, updated_at, description)
values
  ('b9ec6994-3765-4a06-a072-6bcf6b619645','Anal Toys','anal-toys',true,'{}'::jsonb,null,true,null,'2025-09-23T16:46:39.427646+00:00',4,'2025-09-23T16:46:39.427646+00:00','Anal pleasure products'),
  ('fab40c68-9812-4dc7-ad67-a06b2ffc951b','BDSM & Fetish','bdsm-fetish',true,'{}'::jsonb,null,true,null,'2025-09-23T16:46:39.427646+00:00',6,'2025-09-23T16:46:39.427646+00:00','Bondage and fetish items'),
  ('007b65a9-b2d9-4fdc-878e-af35acdf8319','Couples'' Toys','couples-toys',true,'{}'::jsonb,null,true,null,'2025-09-23T16:46:39.427646+00:00',5,'2025-09-23T16:46:39.427646+00:00','Products for couples'),
  ('8dcd0aec-1ad0-4caa-9799-daf2115425b0','Digital & Virtual','digital-virtual',true,'{}'::jsonb,null,true,null,'2025-09-23T16:46:39.427646+00:00',10,'2025-09-23T16:46:39.427646+00:00','Digital content and experiences'),
  ('05deaf97-e62b-4626-9c29-8d3ad0467305','Dildos & Toys','dildos-toys',true,'{}'::jsonb,null,true,null,'2025-09-23T16:46:39.427646+00:00',2,'2025-09-23T16:46:39.427646+00:00','Non-vibrating intimate toys'),
  ('1c294c21-48e9-451f-97e3-8a20595f53e7','Gift Sets & Bundles','gift-sets-bundles',true,'{}'::jsonb,null,true,null,'2025-09-23T16:46:39.427646+00:00',9,'2025-09-23T16:46:39.427646+00:00','Curated product collections'),
  ('4f18affc-a4c8-4c88-896d-41c239e319bf','Lingerie & Apparel','lingerie-apparel',true,'{}'::jsonb,null,true,null,'2025-09-23T16:46:39.427646+00:00',8,'2025-09-23T16:46:39.427646+00:00','Intimate clothing and costumes'),
  ('97eed461-f982-421d-9fe7-d409682ca64a','Lubes & Essentials','lubes-essentials',true,'{}'::jsonb,null,true,null,'2025-09-23T16:46:39.427646+00:00',7,'2025-09-23T16:46:39.427646+00:00','Lubricants and care products'),
  ('9e3c3180-8c24-427b-93d2-939ebb8dec52','Men''s Toys','mens-toys',true,'{}'::jsonb,null,true,null,'2025-09-23T16:46:39.427646+00:00',3,'2025-09-23T16:46:39.427646+00:00','Pleasure products for men'),
  ('b3cd31d8-feba-4d8b-8e47-54f493864bdf','Vibrators','vibrators',true,'{}'::jsonb,null,true,null,'2025-09-23T16:46:39.427646+00:00',1,'2025-09-23T16:46:39.427646+00:00','Vibrating pleasure devices')
on conflict (id) do update set
  name=excluded.name, slug=excluded.slug, is_adult=excluded.is_adult,
  metadata=excluded.metadata, image_url=excluded.image_url,
  is_active=excluded.is_active, parent_id=excluded.parent_id,
  created_at=excluded.created_at, sort_order=excluded.sort_order,
  updated_at=excluded.updated_at, description=excluded.description;

insert into public.categories
  (id, name, slug, is_adult, metadata, image_url, is_active, parent_id, created_at, sort_order, updated_at, description)
values
  ('9d34b5eb-00f4-47b5-a3cb-e7e043b800c7','Bullet Vibrators','bullet-vibrators',true,'{}'::jsonb,null,true,'b3cd31d8-feba-4d8b-8e47-54f493864bdf','2025-09-23T16:46:42.903736+00:00',5,'2025-09-23T16:46:42.903736+00:00','Compact bullet-style toys'),
  ('f8eb089f-6cb5-4693-b48e-5291566dbf1e','Clitoral Vibrators','clitoral-vibrators',true,'{}'::jsonb,null,true,'b3cd31d8-feba-4d8b-8e47-54f493864bdf','2025-09-23T16:46:42.903736+00:00',1,'2025-09-23T16:46:42.903736+00:00','Targeted clitoral stimulation'),
  ('8a4902b9-5eea-4f57-85d1-d9ccf84c1b6e','G-Spot Vibrators','g-spot-vibrators',true,'{}'::jsonb,null,true,'b3cd31d8-feba-4d8b-8e47-54f493864bdf','2025-09-23T16:46:42.903736+00:00',2,'2025-09-23T16:46:42.903736+00:00','Internal G-spot stimulation'),
  ('19b7b478-a9b3-4673-92f7-870b58fc2a3d','Rabbit Vibrators','rabbit-vibrators',true,'{}'::jsonb,null,true,'b3cd31d8-feba-4d8b-8e47-54f493864bdf','2025-09-23T16:46:42.903736+00:00',3,'2025-09-23T16:46:42.903736+00:00','Dual stimulation toys'),
  ('e8586693-62c3-4570-b31b-8a90974adc4e','Remote Control','remote-control-vibrators',true,'{}'::jsonb,null,true,'b3cd31d8-feba-4d8b-8e47-54f493864bdf','2025-09-23T16:46:42.903736+00:00',6,'2025-09-23T16:46:42.903736+00:00','App and remote controlled toys'),
  ('5f8f01ce-bc8c-495c-be20-78290cd9f554','Wand Massagers','wand-massagers',true,'{}'::jsonb,null,true,'b3cd31d8-feba-4d8b-8e47-54f493864bdf','2025-09-23T16:46:42.903736+00:00',4,'2025-09-23T16:46:42.903736+00:00','Powerful wand-style massagers')
on conflict (id) do update set
  name=excluded.name, slug=excluded.slug, is_adult=excluded.is_adult,
  metadata=excluded.metadata, image_url=excluded.image_url,
  is_active=excluded.is_active, parent_id=excluded.parent_id,
  created_at=excluded.created_at, sort_order=excluded.sort_order,
  updated_at=excluded.updated_at, description=excluded.description;

commit;
