-- Public-only search index. Never index drafts, measurements, messages, orders or tickets.
--> statement-breakpoint
CREATE VIEW search_source AS SELECT id,type AS kind,userId AS owner,title,body,category,creator FROM (SELECT d.id,d.user_id AS userId,d.title,d.description AS body,d.category,d.created_at AS createdAt,'design' AS type,'' AS media,'image' AS mediaType,d.config,NULL AS price,0 AS stock,'[]' AS sizes,0 AS shipping,coalesce(p.name,'Independent creator') AS creator FROM designs d LEFT JOIN profiles p ON p.user_id=d.user_id WHERE d.published=1
 UNION ALL SELECT po.id,po.user_id,po.title,po.caption,po.category,po.created_at,'post',po.media_url,po.media_type,NULL,NULL,0,'[]',0,coalesce(p.name,'Independent creator') FROM posts po LEFT JOIN profiles p ON p.user_id=po.user_id
 UNION ALL SELECT l.id,l.user_id,l.title,l.description,l.category,l.created_at,'listing',l.image,'image',NULL,l.price,l.stock,l.sizes,l.shipping,coalesce(nullif((SELECT json_extract(a.details,'$.brandName') FROM portal_accounts a WHERE a.user_id=l.user_id AND a.role='brand'),''),p.name,'Independent label') FROM listings l LEFT JOIN profiles p ON p.user_id=l.user_id WHERE l.published=1) UNION ALL SELECT userId,'person',userId,name||' '||brandName,bio,city||' '||weights,name FROM (SELECT p.user_id AS userId,p.name,p.bio,p.created_at AS createdAt,
 coalesce((SELECT json_extract(a.details,'$.brandName') FROM portal_accounts a WHERE a.user_id=p.user_id AND a.role='brand'),'') AS brandName,
 coalesce((SELECT city FROM style_profiles sp WHERE sp.user_id=p.user_id AND sp.mode='design'),'') AS city,
 coalesce((SELECT weights FROM style_profiles sp WHERE sp.user_id=p.user_id AND sp.mode='design'),'{}') AS weights,
 (SELECT group_concat(a.role) FROM portal_accounts a WHERE a.user_id=p.user_id) AS roles,
 (SELECT count(*) FROM designs d WHERE d.user_id=p.user_id AND d.published=1) AS designCount,
 (SELECT count(*) FROM posts po WHERE po.user_id=p.user_id) AS postCount,
 (SELECT count(*) FROM listings l WHERE l.user_id=p.user_id AND l.published=1) AS productCount,
 (SELECT count(*) FROM follows f WHERE f.target_id=p.user_id) AS followers
 ,coalesce((SELECT avatar FROM member_preferences m WHERE m.user_id=p.user_id),'') AS avatar,
 coalesce((SELECT discoverable FROM member_preferences m WHERE m.user_id=p.user_id),1) AS discoverable,
 (SELECT count(*) FROM posts po WHERE po.user_id=p.user_id AND po.media_type='video') AS reelCount,
 (SELECT count(*) FROM follows f WHERE f.follower_id=p.user_id) AS following,
 CASE WHEN coalesce((SELECT show_sales FROM member_preferences m WHERE m.user_id=p.user_id),1)=1 THEN
 (SELECT coalesce(sum(quantity),0) FROM purchases pu WHERE pu.seller_id=p.user_id AND pu.mode='live' AND pu.payment_status='paid' AND pu.refunded=0) ELSE NULL END AS unitsSold
 FROM profiles p) WHERE discoverable=1;
--> statement-breakpoint
CREATE VIRTUAL TABLE search_index USING fts5(id UNINDEXED,kind UNINDEXED,owner UNINDEXED,title,body,category,creator,tokenize='unicode61 remove_diacritics 2',prefix='2 3 4');
--> statement-breakpoint
INSERT INTO search_index SELECT * FROM search_source;
--> statement-breakpoint
CREATE VIRTUAL TABLE search_vocab USING fts5vocab(search_index,'row');
--> statement-breakpoint
CREATE TRIGGER search_designs_insert AFTER INSERT ON designs BEGIN  INSERT INTO search_index SELECT * FROM search_source WHERE id=new.id AND kind='design'; END;
--> statement-breakpoint
CREATE TRIGGER search_designs_update AFTER UPDATE ON designs BEGIN DELETE FROM search_index WHERE id=old.id AND kind='design'; INSERT INTO search_index SELECT * FROM search_source WHERE id=new.id AND kind='design'; END;
--> statement-breakpoint
CREATE TRIGGER search_designs_delete AFTER DELETE ON designs BEGIN DELETE FROM search_index WHERE id=old.id AND kind='design';  END;
--> statement-breakpoint
CREATE TRIGGER search_posts_insert AFTER INSERT ON posts BEGIN  INSERT INTO search_index SELECT * FROM search_source WHERE id=new.id AND kind='post'; END;
--> statement-breakpoint
CREATE TRIGGER search_posts_update AFTER UPDATE ON posts BEGIN DELETE FROM search_index WHERE id=old.id AND kind='post'; INSERT INTO search_index SELECT * FROM search_source WHERE id=new.id AND kind='post'; END;
--> statement-breakpoint
CREATE TRIGGER search_posts_delete AFTER DELETE ON posts BEGIN DELETE FROM search_index WHERE id=old.id AND kind='post';  END;
--> statement-breakpoint
CREATE TRIGGER search_listings_insert AFTER INSERT ON listings BEGIN  INSERT INTO search_index SELECT * FROM search_source WHERE id=new.id AND kind='listing'; END;
--> statement-breakpoint
CREATE TRIGGER search_listings_update AFTER UPDATE ON listings BEGIN DELETE FROM search_index WHERE id=old.id AND kind='listing'; INSERT INTO search_index SELECT * FROM search_source WHERE id=new.id AND kind='listing'; END;
--> statement-breakpoint
CREATE TRIGGER search_listings_delete AFTER DELETE ON listings BEGIN DELETE FROM search_index WHERE id=old.id AND kind='listing';  END;
--> statement-breakpoint
CREATE TRIGGER search_profiles_insert AFTER INSERT ON profiles BEGIN DELETE FROM search_index WHERE owner=new.user_id; INSERT INTO search_index SELECT * FROM search_source WHERE owner=new.user_id; END;
--> statement-breakpoint
CREATE TRIGGER search_profiles_update AFTER UPDATE ON profiles BEGIN DELETE FROM search_index WHERE owner=new.user_id; INSERT INTO search_index SELECT * FROM search_source WHERE owner=new.user_id; END;
--> statement-breakpoint
CREATE TRIGGER search_profiles_delete AFTER DELETE ON profiles BEGIN DELETE FROM search_index WHERE owner=old.user_id; INSERT INTO search_index SELECT * FROM search_source WHERE owner=old.user_id; END;
--> statement-breakpoint
CREATE TRIGGER search_portal_accounts_insert AFTER INSERT ON portal_accounts BEGIN DELETE FROM search_index WHERE owner=new.user_id; INSERT INTO search_index SELECT * FROM search_source WHERE owner=new.user_id; END;
--> statement-breakpoint
CREATE TRIGGER search_portal_accounts_update AFTER UPDATE ON portal_accounts BEGIN DELETE FROM search_index WHERE owner=new.user_id; INSERT INTO search_index SELECT * FROM search_source WHERE owner=new.user_id; END;
--> statement-breakpoint
CREATE TRIGGER search_portal_accounts_delete AFTER DELETE ON portal_accounts BEGIN DELETE FROM search_index WHERE owner=old.user_id; INSERT INTO search_index SELECT * FROM search_source WHERE owner=old.user_id; END;
--> statement-breakpoint
CREATE TRIGGER search_style_profiles_insert AFTER INSERT ON style_profiles BEGIN DELETE FROM search_index WHERE owner=new.user_id; INSERT INTO search_index SELECT * FROM search_source WHERE owner=new.user_id; END;
--> statement-breakpoint
CREATE TRIGGER search_style_profiles_update AFTER UPDATE ON style_profiles BEGIN DELETE FROM search_index WHERE owner=new.user_id; INSERT INTO search_index SELECT * FROM search_source WHERE owner=new.user_id; END;
--> statement-breakpoint
CREATE TRIGGER search_style_profiles_delete AFTER DELETE ON style_profiles BEGIN DELETE FROM search_index WHERE owner=old.user_id; INSERT INTO search_index SELECT * FROM search_source WHERE owner=old.user_id; END;
--> statement-breakpoint
CREATE TRIGGER search_member_preferences_insert AFTER INSERT ON member_preferences BEGIN DELETE FROM search_index WHERE owner=new.user_id; INSERT INTO search_index SELECT * FROM search_source WHERE owner=new.user_id; END;
--> statement-breakpoint
CREATE TRIGGER search_member_preferences_update AFTER UPDATE ON member_preferences BEGIN DELETE FROM search_index WHERE owner=new.user_id; INSERT INTO search_index SELECT * FROM search_source WHERE owner=new.user_id; END;
--> statement-breakpoint
CREATE TRIGGER search_member_preferences_delete AFTER DELETE ON member_preferences BEGIN DELETE FROM search_index WHERE owner=old.user_id; INSERT INTO search_index SELECT * FROM search_source WHERE owner=old.user_id; END;
--> statement-breakpoint
CREATE TABLE ai_cache (key TEXT PRIMARY KEY, user_id TEXT NOT NULL, value TEXT NOT NULL, expires_at INTEGER NOT NULL);
--> statement-breakpoint
CREATE INDEX ai_cache_expiry ON ai_cache(expires_at);
--> statement-breakpoint
CREATE TABLE ai_usage (scope TEXT NOT NULL, day TEXT NOT NULL, count INTEGER NOT NULL DEFAULT 0, PRIMARY KEY(scope,day));
