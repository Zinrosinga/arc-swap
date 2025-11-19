// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

// Interface for ERC20 with metadata
interface IERC20Metadata {
    function symbol() external view returns (string memory);
}

/**
 * @title SimpleAMMPair
 * @notice AMM pair contract inspired by Uniswap V2. Supports mint/burn LP tokens
 *         and swap exact-in for either token, using x*y = k with 0.3% fee.
 */
contract SimpleAMMPair {
    
    // ---------------------------------------------------------------------
    // LP token metadata
    // ---------------------------------------------------------------------
    uint8 public constant decimals = 18;
    
    function name() public view returns (string memory) {
        return string(abi.encodePacked(
            IERC20Metadata(token0).symbol(),
            "/",
            IERC20Metadata(token1).symbol(),
            " LP"
        ));
    }
    
    function symbol() public view returns (string memory) {
        return string(abi.encodePacked(
            IERC20Metadata(token0).symbol(),
            "-",
            IERC20Metadata(token1).symbol()
        ));
    }
    uint256 public constant MINIMUM_LIQUIDITY = 1000;

    // ---------------------------------------------------------------------
    // Immutable pair tokens
    // ---------------------------------------------------------------------
    address public immutable token0;
    address public immutable token1;

    // ---------------------------------------------------------------------
    // LP accounting
    // ---------------------------------------------------------------------
    uint256 public totalSupply;
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    // ---------------------------------------------------------------------
    // Reserves
    // ---------------------------------------------------------------------
    uint112 private reserve0;
    uint112 private reserve1;

    uint256 private unlocked = 1;
    modifier lock() {
        require(unlocked == 1, "LOCKED");
        unlocked = 0;
        _;
        unlocked = 1;
    }

    // ---------------------------------------------------------------------
    // Events
    // ---------------------------------------------------------------------
    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);
    event Mint(address indexed sender, uint256 amount0, uint256 amount1, address indexed to);
    event Burn(address indexed sender, uint256 amount0, uint256 amount1, address indexed to);
    event Swap(address indexed sender, uint256 amountIn, uint256 amountOut, address indexed to);
    event Sync(uint112 reserve0, uint112 reserve1);

    constructor(address _tokenA, address _tokenB) {
        require(_tokenA != _tokenB, "IDENTICAL_ADDRESSES");
        (address _token0, address _token1) = _tokenA < _tokenB ? (_tokenA, _tokenB) : (_tokenB, _tokenA);
        token0 = _token0;
        token1 = _token1;
    }

    // ---------------------------------------------------------------------
    // ERC20 logic
    // ---------------------------------------------------------------------
    function approve(address spender, uint256 value) external returns (bool) {
        allowance[msg.sender][spender] = value;
        emit Approval(msg.sender, spender, value);
        return true;
    }

    function transfer(address to, uint256 value) external returns (bool) {
        _transfer(msg.sender, to, value);
        return true;
    }

    function transferFrom(address from, address to, uint256 value) external returns (bool) {
        uint256 allowed = allowance[from][msg.sender];
        if (allowed != type(uint256).max) {
            allowance[from][msg.sender] = allowed - value;
        }
        _transfer(from, to, value);
        return true;
    }

    function _transfer(address from, address to, uint256 value) private {
        require(to != address(0), "ZERO_ADDRESS");
        balanceOf[from] -= value;
        balanceOf[to] += value;
        emit Transfer(from, to, value);
    }

    function _mint(address to, uint256 value) private {
        totalSupply += value;
        balanceOf[to] += value;
        emit Transfer(address(0), to, value);
    }

    function _burn(address from, uint256 value) private {
        balanceOf[from] -= value;
        totalSupply -= value;
        emit Transfer(from, address(0), value);
    }

    // ---------------------------------------------------------------------
    // Reserve helpers
    // ---------------------------------------------------------------------
    function getReserves() public view returns (uint112, uint112) {
        return (reserve0, reserve1);
    }

    function _update(uint256 balance0, uint256 balance1) private {
        reserve0 = uint112(balance0);
        reserve1 = uint112(balance1);
        emit Sync(reserve0, reserve1);
    }

    function _sqrt(uint256 y) private pure returns (uint256 z) {
        if (y > 3) {
            z = y;
            uint256 x = y / 2 + 1;
            while (x < z) {
                z = x;
                x = (y / x + x) / 2;
            }
        } else if (y != 0) {
            z = 1;
        }
    }

    function _min(uint256 x, uint256 y) private pure returns (uint256) {
        return x < y ? x : y;
    }

    function _getAmountOut(uint256 amountIn, uint112 reserveIn, uint112 reserveOut)
        private
        pure
        returns (uint256)
    {
        require(amountIn > 0, "INSUFFICIENT_INPUT");
        require(reserveIn > 0 && reserveOut > 0, "INSUFFICIENT_LIQUIDITY");

        uint256 amountInWithFee = amountIn * 997; // 0.3% fee retained in pool
        uint256 numerator = amountInWithFee * reserveOut;
        uint256 denominator = reserveIn * 1000 + amountInWithFee;
        return numerator / denominator;
    }

    // ---------------------------------------------------------------------
    // Liquidity
    // ---------------------------------------------------------------------
    function addLiquidity(
        uint256 /*amountADesired*/,
        uint256 /*amountBDesired*/,
        address to
    )
        external
        lock
        returns (uint256 liquidity, uint256 amount0, uint256 amount1)
    {
        (uint112 _reserve0, uint112 _reserve1) = getReserves();
        uint256 balance0 = IERC20(token0).balanceOf(address(this));
        uint256 balance1 = IERC20(token1).balanceOf(address(this));
        amount0 = balance0 - _reserve0;
        amount1 = balance1 - _reserve1;
        require(amount0 > 0 && amount1 > 0, "INSUFFICIENT_DEPOSIT");

        if (totalSupply == 0) {
            liquidity = _sqrt(amount0 * amount1) - MINIMUM_LIQUIDITY;
            _mint(address(0), MINIMUM_LIQUIDITY);
        } else {
            liquidity = _min((amount0 * totalSupply) / _reserve0, (amount1 * totalSupply) / _reserve1);
        }

        require(liquidity > 0, "INSUFFICIENT_LIQUIDITY_MINTED");
        _mint(to, liquidity);

        _update(balance0, balance1);
        emit Mint(msg.sender, amount0, amount1, to);
    }

    function removeLiquidity(uint256 liquidity, address to)
        external
        lock
        returns (uint256 amount0, uint256 amount1)
    {
        require(liquidity > 0, "ZERO_LIQUIDITY");

        uint256 balance0 = IERC20(token0).balanceOf(address(this));
        uint256 balance1 = IERC20(token1).balanceOf(address(this));

        amount0 = (liquidity * balance0) / totalSupply;
        amount1 = (liquidity * balance1) / totalSupply;
        require(amount0 > 0 || amount1 > 0, "INSUFFICIENT_LIQUIDITY_BURNED");

        // Fix: Burn from address(this) because router already transferred LP tokens to pair
        _burn(address(this), liquidity);
        if (amount0 > 0) IERC20(token0).transfer(to, amount0);
        if (amount1 > 0) IERC20(token1).transfer(to, amount1);

        balance0 = IERC20(token0).balanceOf(address(this));
        balance1 = IERC20(token1).balanceOf(address(this));
        _update(balance0, balance1);
        emit Burn(msg.sender, amount0, amount1, to);
    }

    // ---------------------------------------------------------------------
    // Swaps (exact-in)
    // ---------------------------------------------------------------------
    function swapExactToken0ForToken1(
        uint256 /*amountInExpected*/,
        uint256 amountOutMin,
        address to
    )
        external
        lock
        returns (uint256 amountOut)
    {
        (uint112 _reserve0, uint112 _reserve1) = getReserves();
        uint256 balance0 = IERC20(token0).balanceOf(address(this));
        uint256 amountIn = balance0 - _reserve0;
        amountOut = _getAmountOut(amountIn, _reserve0, _reserve1);
        require(amountOut >= amountOutMin, "SLIPPAGE");

        IERC20(token1).transfer(to, amountOut);
        uint256 balance1 = IERC20(token1).balanceOf(address(this));
        _update(balance0, balance1);

        emit Swap(msg.sender, amountIn, amountOut, to);
    }

    function swapExactToken1ForToken0(
        uint256 /*amountInExpected*/,
        uint256 amountOutMin,
        address to
    )
        external
        lock
        returns (uint256 amountOut)
    {
        (uint112 _reserve0, uint112 _reserve1) = getReserves();
        uint256 balance1 = IERC20(token1).balanceOf(address(this));
        uint256 amountIn = balance1 - _reserve1;
        amountOut = _getAmountOut(amountIn, _reserve1, _reserve0);
        require(amountOut >= amountOutMin, "SLIPPAGE");

        IERC20(token0).transfer(to, amountOut);
        uint256 balance0 = IERC20(token0).balanceOf(address(this));
        _update(balance0, balance1);

        emit Swap(msg.sender, amountIn, amountOut, to);
    }
}

