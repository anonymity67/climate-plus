# Beta-Binomial update: prior Beta(a, b), data passes out of tests.
# Posterior is Beta(a + passes, b + tests - passes); interval is the 95% credible interval.
beta_binomial_update <- function(passes, tests, a = 1, b = 1) {
  a_post <- a + passes
  b_post <- b + tests - passes
  data.frame(
    mean  = a_post / (a_post + b_post),
    lower = qbeta(0.025, a_post, b_post),
    upper = qbeta(0.975, a_post, b_post)
  )
}
