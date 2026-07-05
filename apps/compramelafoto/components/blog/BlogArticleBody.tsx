type BlogArticleBodyProps = {
  html: string;
};

export default function BlogArticleBody({ html }: BlogArticleBodyProps) {
  return (
    <div
      className="blog-article-body ds-fill-width"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
