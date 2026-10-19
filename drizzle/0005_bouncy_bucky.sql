CREATE TABLE `notifications` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`recipient_id` text NOT NULL,
	`actor_id` text NOT NULL,
	`kind` text NOT NULL,
	`entity_id` text NOT NULL,
	`target_kind` text NOT NULL,
	`target_id` text NOT NULL,
	`title` text DEFAULT '' NOT NULL,
	`created_at` text NOT NULL,
	`read_at` text
);
--> statement-breakpoint
CREATE INDEX `notifications_recipient_id` ON `notifications` (`recipient_id`,`id`);--> statement-breakpoint
CREATE UNIQUE INDEX `notification_event` ON `notifications` (`kind`,`entity_id`,`actor_id`,`recipient_id`);
--> statement-breakpoint
CREATE TRIGGER notify_like AFTER INSERT ON likes  BEGIN
 INSERT OR IGNORE INTO notifications(recipient_id,actor_id,kind,entity_id,target_kind,target_id,title,created_at) SELECT c.user_id,NEW.user_id,'like',NEW.product_id,'content',c.id,c.title,NEW.created_at FROM (SELECT id,user_id,title FROM designs WHERE published=1 UNION ALL SELECT id,user_id,title FROM posts UNION ALL SELECT id,user_id,title FROM listings WHERE published=1) c WHERE c.id=NEW.product_id AND c.user_id<>NEW.user_id;
END;
--> statement-breakpoint
CREATE TRIGGER remove_like_notification AFTER DELETE ON likes BEGIN DELETE FROM notifications WHERE kind='like' AND entity_id=OLD.product_id AND actor_id=OLD.user_id; END;
--> statement-breakpoint
CREATE TRIGGER notify_comment AFTER INSERT ON comments  BEGIN
 INSERT OR IGNORE INTO notifications(recipient_id,actor_id,kind,entity_id,target_kind,target_id,title,created_at) SELECT c.user_id,NEW.user_id,'comment',NEW.id,'content',c.id,c.title,NEW.created_at FROM (SELECT id,user_id,title FROM designs WHERE published=1 UNION ALL SELECT id,user_id,title FROM posts UNION ALL SELECT id,user_id,title FROM listings WHERE published=1) c WHERE c.id=NEW.product_id AND c.user_id<>NEW.user_id;
END;
--> statement-breakpoint
CREATE TRIGGER remove_comment_notification AFTER DELETE ON comments BEGIN DELETE FROM notifications WHERE kind='comment' AND entity_id=OLD.id AND actor_id=OLD.user_id; END;
--> statement-breakpoint
CREATE TRIGGER notify_follow AFTER INSERT ON follows  BEGIN
 INSERT OR IGNORE INTO notifications(recipient_id,actor_id,kind,entity_id,target_kind,target_id,title,created_at) SELECT NEW.target_id,NEW.follower_id,'follow',NEW.target_id,'profile',NEW.follower_id,'',NEW.created_at WHERE NEW.target_id<>NEW.follower_id;
END;
--> statement-breakpoint
CREATE TRIGGER remove_follow_notification AFTER DELETE ON follows BEGIN DELETE FROM notifications WHERE kind='follow' AND entity_id=OLD.target_id AND actor_id=OLD.follower_id; END;
--> statement-breakpoint
CREATE TRIGGER notify_connection AFTER INSERT ON conversations  BEGIN
 INSERT OR IGNORE INTO notifications(recipient_id,actor_id,kind,entity_id,target_kind,target_id,title,created_at) SELECT NEW.designer_id,NEW.buyer_id,'connection',NEW.id,'conversation',NEW.id,NEW.context,NEW.updated_at WHERE NEW.designer_id<>NEW.buyer_id;
END;
--> statement-breakpoint
CREATE TRIGGER notify_message AFTER INSERT ON chat_messages  BEGIN
 INSERT OR IGNORE INTO notifications(recipient_id,actor_id,kind,entity_id,target_kind,target_id,title,created_at) SELECT CASE WHEN NEW.sender_id=c.buyer_id THEN c.designer_id ELSE c.buyer_id END,NEW.sender_id,'message',NEW.id,'conversation',c.id,c.context,NEW.created_at FROM conversations c WHERE c.id=NEW.conversation_id AND NEW.sender_id IN (c.buyer_id,c.designer_id) AND c.buyer_id<>c.designer_id;
END;
--> statement-breakpoint
CREATE TRIGGER notify_proposal AFTER INSERT ON design_bids  BEGIN
 INSERT OR IGNORE INTO notifications(recipient_id,actor_id,kind,entity_id,target_kind,target_id,title,created_at) SELECT r.buyer_id,NEW.designer_id,'proposal',NEW.id,'request',r.id,r.title,NEW.created_at FROM design_requests r WHERE r.id=NEW.request_id AND r.buyer_id<>NEW.designer_id;
END;
--> statement-breakpoint
CREATE TRIGGER notify_acceptance AFTER INSERT ON commissions  BEGIN
 INSERT OR IGNORE INTO notifications(recipient_id,actor_id,kind,entity_id,target_kind,target_id,title,created_at) SELECT NEW.designer_id,NEW.buyer_id,'proposal_accepted',NEW.id,'commission',NEW.id,NEW.title,NEW.created_at WHERE NEW.designer_id<>NEW.buyer_id;
END;
--> statement-breakpoint
CREATE TRIGGER notify_evidence AFTER INSERT ON quality_evidence  BEGIN
 INSERT OR IGNORE INTO notifications(recipient_id,actor_id,kind,entity_id,target_kind,target_id,title,created_at) SELECT c.buyer_id,NEW.designer_id,CASE WHEN NEW.stage='dispatch' THEN 'design_ready' ELSE 'materials_ready' END,NEW.id,'commission',c.id,c.title,NEW.created_at FROM commissions c WHERE c.id=NEW.commission_id AND c.buyer_id<>NEW.designer_id;
END;
--> statement-breakpoint
CREATE TRIGGER notify_review AFTER UPDATE OF review,feedback ON quality_evidence
 WHEN NEW.review<>OLD.review OR NEW.feedback<>OLD.feedback BEGIN
 DELETE FROM notifications WHERE kind IN ('review_approved','changes_requested') AND entity_id=NEW.id;
 INSERT INTO notifications(recipient_id,actor_id,kind,entity_id,target_kind,target_id,title,created_at) SELECT NEW.designer_id,c.buyer_id,CASE WHEN NEW.review='approved' THEN 'review_approved' ELSE 'changes_requested' END,NEW.id,'commission',c.id,c.title,strftime('%Y-%m-%dT%H:%M:%fZ','now') FROM commissions c WHERE c.id=NEW.commission_id AND NEW.review IN ('approved','changes_requested') AND NEW.designer_id<>c.buyer_id;
END;
--> statement-breakpoint
CREATE TRIGGER read_message_notifications_insert AFTER INSERT ON conversation_reads BEGIN
 UPDATE notifications SET read_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE recipient_id=NEW.user_id AND target_kind='conversation' AND target_id=NEW.conversation_id AND kind IN ('message','connection') AND created_at<=NEW.last_read_at AND read_at IS NULL;
 END;
--> statement-breakpoint
CREATE TRIGGER read_message_notifications_update AFTER UPDATE OF last_read_at ON conversation_reads BEGIN
 UPDATE notifications SET read_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE recipient_id=NEW.user_id AND target_kind='conversation' AND target_id=NEW.conversation_id AND kind IN ('message','connection') AND created_at<=NEW.last_read_at AND read_at IS NULL;
 END;
