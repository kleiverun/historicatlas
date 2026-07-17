package com.backend.historytimeline.config;

import jakarta.validation.ConstraintViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;

import java.util.stream.Collectors;

/**
 * Maps bad request parameters to a 400 with an RFC 7807 "problem detail"
 * JSON body, instead of the framework defaults (which are a 500 for
 * constraint violations -- validation failing on OUR annotations is the
 * caller's fault, not a server error).
 */
@RestControllerAdvice
public class ApiExceptionHandler {

    // @Min/@Max violations on @RequestParam, e.g. zoom=25. The exception
    // message alone reads like "getBorders.zoom: must be less than or
    // equal to 18" -- the method name is noise to an API caller, so
    // rebuild the message from the parameter name only.
    @ExceptionHandler(ConstraintViolationException.class)
    public ProblemDetail onConstraintViolation(ConstraintViolationException e) {
        String detail = e.getConstraintViolations().stream()
                .map(v -> lastNode(v.getPropertyPath().toString()) + " " + v.getMessage())
                .sorted()
                .collect(Collectors.joining("; "));
        return problem("Invalid request parameter", detail);
    }

    // Type conversion failures, e.g. date=not-a-date or zoom=abc.
    @ExceptionHandler(MethodArgumentTypeMismatchException.class)
    public ProblemDetail onTypeMismatch(MethodArgumentTypeMismatchException e) {
        String detail = "Parameter '" + e.getName() + "' has invalid value '"
                + e.getValue() + "'. Expected format for date: yyyy-MM-dd.";
        return problem("Invalid request parameter", detail);
    }

    private static ProblemDetail problem(String title, String detail) {
        ProblemDetail problemDetail = ProblemDetail.forStatus(HttpStatus.BAD_REQUEST);
        problemDetail.setTitle(title);
        problemDetail.setDetail(detail);
        return problemDetail;
    }

    // "getBorders.zoom" -> "zoom"
    private static String lastNode(String propertyPath) {
        int lastDot = propertyPath.lastIndexOf('.');
        return lastDot < 0 ? propertyPath : propertyPath.substring(lastDot + 1);
    }
}
