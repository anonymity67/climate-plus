test_that("beta-binomial posterior mean is correct", {
  expect_equal(beta_binomial_update(2, 3)$mean, 0.6)
  expect_equal(beta_binomial_update(2, 3, a = 2, b = 1)$mean, 4 / 6)
  expect_equal(beta_binomial_update(0, 0)$mean, 0.5)
})

test_that("vectorised input returns one row per input with ordered interval", {
  r <- beta_binomial_update(c(0, 2, 5), c(0, 3, 5))
  expect_equal(nrow(r), 3)
  expect_identical(names(r), c("mean", "lower", "upper"))
  expect_true(all(r$lower <= r$mean & r$mean <= r$upper))
})
