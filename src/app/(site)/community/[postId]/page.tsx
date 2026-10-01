"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { BadgeCheck, Lock, Store } from "lucide-react";
import { ApiClientError, businessApi, communityApi } from "@/lib/api";
import { BusinessPostCard } from "@/components/promo/business-post-card";
import { communityWriteBlock, topicLabel, useCommunitySettings, useCommunityStanding } from "@/lib/community-settings";
import { useAuth } from "@/lib/auth-context";
import { useAuthModal } from "@/lib/auth-modal-context";
import { needsCommunitySetup, useCommunityUsernameModal } from "@/lib/community-username-modal-context";
import { applyVoteDelta } from "@/lib/community-vote";
import { COMMUNITY_POST_TYPE_META } from "@/lib/community-constants";
import { errorMessage, useToast } from "@/lib/toast-context";
import { useLanguage } from "@/lib/language-context";
import { cn } from "@/lib/utils";
import type { CommunityCommentResponse, CommunityPostResponse, CommunityPostVoteType } from "@/lib/types";
import { CommunityCommentThread } from "@/components/community-comment-thread";
import { CommunityMarkdown } from "@/components/community-markdown";
import {
  CommunityRestrictionNotice,
  PendingReviewNote,
  PostModerationLabels,
  RemovedPostPlaceholder,
} from "@/components/community-moderation";
import { CommunityPostPhotoGrid } from "@/components/community-post-photo-grid";
import { CommunityPoll } from "@/components/community-poll";
import { PostActions } from "@/components/community-post-actions";
import { PostHeader } from "@/components/community-post-header";
import { PostMenu } from "@/components/community-post-menu";
import { QuestionStatusBadge } from "@/components/community-question-status-badge";
import { VoteControls } from "@/components/vote-controls";
import { Badge, ErrorBanner, PageSpinner } from "@/components/ui/misc";
import { Button } from "@/components/ui/button";

const COMMENTS_PAGE_SIZE = 200;

export default function CommunityPostDetailPage() {
  const { postId } = useParams<{ postId: string }>();
  const router = useRouter();
  const { user, profile } = useAuth();
  const { openLogin } = useAuthModal();
  const { openModal: openUsernameModal } = useCommunityUsernameModal();
  const { show } = useToast();
  const settings = useCommunitySettings();
  const { standing, refresh: refreshStanding } = useCommunityStanding();
  const { t } = useLanguage();

  const [post, setPost] = useState<CommunityPostResponse | null>(null);
  const [comments, setComments] = useState<CommunityCommentResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [commentText, setCommentText] = useState("");
  const [postingComment, setPostingComment] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const commentInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    Promise.all([communityApi.get(postId), communityApi.listComments(postId, 0, COMMENTS_PAGE_SIZE)])
      .then(([postRes, commentsRes]) => {
        setPost(postRes);
        setComments(commentsRes.content);
      })
      .catch((err) => setError(errorMessage(err)))
      .finally(() => setLoading(false));
  }, [postId]);

  useEffect(load, [load]);

  // V58: the owner of a business post may reply AS that business (own posts only — enforced server-side).
  const [ownsPostBusiness, setOwnsPostBusiness] = useState(false);
  const [replyAsBusiness, setReplyAsBusiness] = useState(true);
  const postBusinessId = post?.business?.id ?? null;
  useEffect(() => {
    if (!postBusinessId || user?.role !== "BUSINESS_OWNER") {
      setOwnsPostBusiness(false);
      return;
    }
    businessApi
      .mine()
      .then((mine) => setOwnsPostBusiness(mine.some((b) => b.id === postBusinessId)))
      .catch(() => setOwnsPostBusiness(false));
  }, [postBusinessId, user?.role]);

  async function handleVote(type: CommunityPostVoteType) {
    if (!post) return;
    await communityApi.vote(post.id, type);
    setPost(applyVoteDelta(post, type));
  }

  async function handleDelete() {
    if (!post || !confirm("Delete this post?")) return;
    setDeleting(true);
    try {
      await communityApi.remove(post.id);
      show("Post deleted", "success");
      router.push("/community");
    } catch (err) {
      show(errorMessage(err), "error");
      setDeleting(false);
    }
  }

  function startComment() {
    if (!user) {
      openLogin();
      return;
    }
    if (!(replyAsBusiness && ownsPostBusiness) && needsCommunitySetup(profile)) {
      openUsernameModal();
      return;
    }
  }

  async function submitComment() {
    if (!commentText.trim() || postingComment || !post) return;
    if (!user) {
      openLogin();
      return;
    }
    const asBusiness = replyAsBusiness && ownsPostBusiness && post.business ? post.business.id : null;
    if (!asBusiness && needsCommunitySetup(profile)) {
      openUsernameModal();
      return;
    }
    setPostingComment(true);
    try {
      const comment = await communityApi.addComment(post.id, commentText.trim(), null, asBusiness);
      setComments((prev) => [...prev, comment]);
      setCommentText("");
      // A comment held for review isn't counted (or shown to others) until it's approved.
      if (comment.status !== "PENDING") setPost({ ...post, commentCount: post.commentCount + 1 });
      else show("Your comment is waiting for review.", "success");
    } catch (err) {
      if (err instanceof ApiClientError && err.status === 403) refreshStanding();
      show(errorMessage(err), "error");
    } finally {
      setPostingComment(false);
    }
  }

  function handleCommentAdded(comment: CommunityCommentResponse) {
    setComments((prev) => [...prev, comment]);
    if (comment.status === "PENDING") {
      show("Your reply is waiting for review.", "success");
      return;
    }
    setPost((prev) => (prev ? { ...prev, commentCount: prev.commentCount + 1 } : prev));
  }

  function handleCommentChanged(comment: CommunityCommentResponse) {
    setComments((prev) => prev.map((c) => (c.id === comment.id ? comment : c)));
  }

  function handleCommentDeleted(commentId: string) {
    setComments((prev) => prev.filter((c) => c.id !== commentId));
    setPost((prev) => (prev ? { ...prev, commentCount: Math.max(0, prev.commentCount - 1) } : prev));
  }

  function handleBestAnswerMarked(updated: CommunityCommentResponse) {
    setComments((prev) => prev.map((c) => (c.id === updated.id ? updated : { ...c, isBestAnswer: false })));
    setPost((prev) => (prev && prev.questionStatus !== "CLOSED" ? { ...prev, questionStatus: "RESOLVED" } : prev));
  }

  function handleBestAnswerUnmarked(updated: CommunityCommentResponse) {
    setComments((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
    setPost((prev) => (prev && prev.questionStatus !== "CLOSED" ? { ...prev, questionStatus: "OPEN" } : prev));
  }

  async function handleCloseQuestion() {
    if (!post) return;
    try {
      await communityApi.closeQuestion(post.id);
      setPost((prev) => (prev ? { ...prev, questionStatus: "CLOSED" } : prev));
      show("Question closed", "success");
    } catch (err) {
      show(errorMessage(err), "error");
    }
  }

  async function handleReopenQuestion() {
    if (!post) return;
    try {
      await communityApi.reopenQuestion(post.id);
      const hasBestAnswer = comments.some((c) => c.isBestAnswer);
      setPost((prev) => (prev ? { ...prev, questionStatus: hasBestAnswer ? "RESOLVED" : "OPEN" } : prev));
      show("Question reopened", "success");
    } catch (err) {
      show(errorMessage(err), "error");
    }
  }

  function focusCommentInput() {
    commentInputRef.current?.focus();
    commentInputRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  if (loading) return <PageSpinner />;
  if (error || !post) return <ErrorBanner message={error ?? "Post not found"} />;

  const isAuthor = profile?.communityProfileId === post.author.id;
  const isRemoved = post.status === "REMOVED";
  const writeBlock = communityWriteBlock(settings);
  const isQuestion = post.postType === "QUESTION";
  const typeMeta = COMMUNITY_POST_TYPE_META[post.postType];
  const business = post.mentionedBusinesses[0] ?? null;

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 sm:px-0">
      <Link href="/community" className="text-sm font-medium text-ink-500 hover:text-ink-800">
        ← Back to Community
      </Link>

      {post.business ? (
        // V58: a post published as a business — business identity, creative and CTA.
        <div className="mt-4 rounded-xl border border-ink-100 bg-surface px-5">
          <BusinessPostCard post={post} detail onChanged={setPost} onDeleted={() => router.push("/community")} />
        </div>
      ) : (
      <div className="mt-4 rounded-xl border border-ink-100 bg-surface p-5 transition-shadow duration-200 hover:shadow-card">
        <div className="flex items-start justify-between gap-2">
          <PostHeader author={post.author} area={post.area} createdAt={post.createdAt} size="md" />
          <PostMenu
            isAuthor={isAuthor}
            canReport={Boolean(user) && !isAuthor && !post.official && !isRemoved}
            targetId={post.id}
            onDelete={handleDelete}
            deleting={deleting}
            questionStatus={post.questionStatus}
            onCloseQuestion={handleCloseQuestion}
            onReopenQuestion={handleReopenQuestion}
          />
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <PostModerationLabels post={post} />
          {post.postType !== "DISCUSSION" && (
            <Badge tone={post.postType === "RECOMMENDATION" ? "gold" : "neutral"}>
              <typeMeta.icon size={11} className="shrink-0" /> {typeMeta.label}
            </Badge>
          )}
          {post.questionStatus && <QuestionStatusBadge status={post.questionStatus} />}
          <Badge tone="crimson">{topicLabel(settings, post.topic)}</Badge>
        </div>

        {isRemoved && <RemovedPostPlaceholder post={post} />}
        {isAuthor && (post.status === "PENDING" || post.status === "HIDDEN") && <PendingReviewNote />}

        {post.title && (
          <h1 className="mt-2 font-display text-xl font-bold leading-snug text-ink-900">{post.title}</h1>
        )}

        {post.body && (
          <CommunityMarkdown
            className={cn(post.title ? "mt-2 text-sm text-ink-700" : "mt-2 text-base text-ink-900")}
          >
            {post.body}
          </CommunityMarkdown>
        )}

        {post.postType === "POLL" && post.poll && (
          <CommunityPoll postId={post.id} poll={post.poll} onVoted={(poll) => setPost((prev) => (prev ? { ...prev, poll } : prev))} />
        )}

        <CommunityPostPhotoGrid urls={post.imageUrls} />

        {business && (
          <Link
            href={`/business/${business.slug}`}
            className="mt-3 inline-flex items-center gap-1 rounded-full bg-ink-50 px-2.5 py-1 text-xs font-medium text-ink-700 hover:bg-ink-100"
          >
            <Store size={13} className="shrink-0" /> {business.name}
            {business.verified && <BadgeCheck size={14} className="shrink-0 text-brand-600" aria-label="Verified business" />}
          </Link>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-ink-100 pt-3">
          {!isRemoved && <VoteControls score={post.score} myVote={post.myVote} onVote={handleVote} orientation="horizontal" />}
          <PostActions
            commentCount={isQuestion ? post.answerCount : post.commentCount}
            shareUrl={`/community/${post.id}`}
            shareTitle={post.title ?? "Jachai Community"}
            onCommentClick={focusCommentInput}
            label={isQuestion ? "Answer" : "Comment"}
          />
        </div>
      </div>
      )}

      <div className="mt-6">
        <h2 className="text-sm font-bold text-ink-900">
          {isQuestion
            ? `${post.answerCount} Answer${post.answerCount === 1 ? "" : "s"}`
            : `${post.commentCount} Comment${post.commentCount === 1 ? "" : "s"}`}
        </h2>

        {isRemoved ? (
          <p className="mt-2 text-sm text-ink-400">This post was removed by moderators — no new comments.</p>
        ) : post.locked ? (
          <p className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-ink-50 px-3 py-2 text-sm text-ink-600">
            <Lock size={14} className="shrink-0" /> Comments are turned off
          </p>
        ) : post.status === "PENDING" || post.status === "HIDDEN" ? (
          <p className="mt-2 text-sm text-ink-400">Comments open once a moderator approves this post.</p>
        ) : writeBlock ? (
          <p className="mt-2 text-sm text-ink-500">{writeBlock}</p>
        ) : standing?.restricted ? (
          <CommunityRestrictionNotice standing={standing} className="mt-2" />
        ) : isQuestion && post.questionStatus === "CLOSED" ? (
          <p className="mt-2 text-sm text-ink-400">This question is closed to new answers.</p>
        ) : user ? (
          <div className="mt-2 flex flex-col gap-1.5">
          {ownsPostBusiness && post.business && (
            <label className="inline-flex min-h-11 items-center gap-2 text-sm text-ink-600">
              <input
                type="checkbox"
                checked={replyAsBusiness}
                onChange={(e) => setReplyAsBusiness(e.target.checked)}
                className="h-4 w-4 accent-crimson-600"
              />
              {t("promo.reply_as", { name: post.business.name })}
            </label>
          )}
          <div className="flex items-start gap-2">
            <input
              ref={commentInputRef}
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              onFocus={startComment}
              onKeyDown={(e) => {
                if (e.key === "Enter") submitComment();
              }}
              placeholder={isQuestion ? "Write your answer…" : "Add a comment…"}
              className="flex-1 rounded-full border border-ink-200 bg-surface px-3.5 py-2 text-sm placeholder:text-ink-300 focus:outline-none focus:ring-2 focus:ring-crimson-500/30 focus:border-crimson-500"
            />
            <Button size="sm" onClick={submitComment} loading={postingComment} disabled={!commentText.trim()}>
              {isQuestion ? "Post Answer" : "Comment"}
            </Button>
          </div>
          </div>
        ) : (
          <button type="button" onClick={openLogin} className="mt-2 text-sm text-crimson-700 hover:underline">
            {isQuestion ? "Log in to answer" : "Log in to comment"}
          </button>
        )}

        <div className="mt-5">
          <CommunityCommentThread
            postId={post.id}
            comments={comments}
            isPostAuthor={isAuthor}
            postAuthorId={post.author.id}
            isQuestion={isQuestion}
            canReply={!isRemoved && !post.locked && !writeBlock && !standing?.restricted && post.status !== "PENDING" && post.status !== "HIDDEN"}
            onCommentAdded={handleCommentAdded}
            onCommentChanged={handleCommentChanged}
            onCommentDeleted={handleCommentDeleted}
            onBestAnswerMarked={handleBestAnswerMarked}
            onBestAnswerUnmarked={handleBestAnswerUnmarked}
          />
        </div>
      </div>
    </div>
  );
}
